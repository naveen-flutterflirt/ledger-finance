import { PoolClient } from 'pg';
import { query, one, tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { LedgerService } from './ledger.service.js';
import { r2 } from '../utils/money.js';
import { PayrollSettings } from '../models/types.js';

export class PayrollService {
  private static daysIn(period: string): number {
    return new Date(Date.UTC(+period.slice(0, 4), +period.slice(5, 7), 0)).getUTCDate();
  }

  private static async getSettings(c: PoolClient, companyId: number): Promise<PayrollSettings> {
    const { rows } = await c.query(
      `SELECT payroll_settings FROM companies WHERE id = $1`,
      [companyId]
    );
    return rows[0].payroll_settings;
  }

  /**
   * Compute a single payslip with Indian labour code rules
   */
  static computeSlip(
    e: any,
    s: PayrollSettings,
    daysInMonth: number,
    lop: number,
    bonus: number,
    otherDed: number
  ) {
    const paid = Math.max(0, daysInMonth - lop);
    const f = paid / daysInMonth;

    const basic = r2(Number(e.basic) * f);
    const hra = r2(Number(e.hra) * f);
    const special = r2(Number(e.special) * f);
    const other = r2(Number(e.other_allow) * f);

    const regular = r2(basic + hra + special + other);
    const gross = r2(regular + bonus);

    let pfWage = 0;
    let pfE = 0;
    let pfR = 0;

    if (e.pf_applicable) {
      pfWage = s.labour_code_50pct_wage ? Math.max(basic, r2(regular / 2)) : basic;
      const base = s.pf_cap_at_ceiling ? Math.min(pfWage, s.pf_wage_ceiling) : pfWage;
      pfE = Math.round((base * s.pf_rate) / 100);
      pfR = Math.round((base * s.pf_employer_rate) / 100);
    }

    const monthlyRate = Number(e.basic) + Number(e.hra) + Number(e.special) + Number(e.other_allow);
    let esiE = 0;
    let esiR = 0;

    // Statutory ESI Wage Base: excludes one-time / discretionary bonuses per ESIC guidelines (Sec 2(22))
    const esiWage = regular;

    if (e.esi_applicable && monthlyRate <= s.esi_ceiling) {
      esiE = Math.ceil((esiWage * s.esi_employee_rate) / 100);
      esiR = Math.ceil((esiWage * s.esi_employer_rate) / 100);
    }

    const pt = e.pt_applicable
      ? s.pt_slabs.find(x => gross >= x.from && gross <= x.to)?.amount ?? 0
      : 0;

    const tds = paid > 0 ? Number(e.monthly_tds) : 0;
    const ded = r2(pfE + esiE + pt + tds + otherDed);

    return {
      days_in_month: daysInMonth,
      lop_days: lop,
      paid_days: paid,
      basic,
      hra,
      special,
      other_allow: other,
      bonus,
      gross,
      pf_wage: r2(pfWage),
      pf_employee: pfE,
      pf_employer: pfR,
      esi_employee: esiE,
      esi_employer: esiR,
      pt,
      tds,
      other_deduction: otherDed,
      total_deductions: ded,
      net_pay: r2(gross - ded),
    };
  }

  private static async writeSlip(c: PoolClient, runId: number, e: any, slip: any) {
    const cols = Object.keys(slip);
    await c.query(
      `INSERT INTO payslips(run_id, employee_id, ${cols.join(',')}) 
       VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(',')})
       ON CONFLICT (run_id, employee_id) DO UPDATE 
       SET ${cols.map(k => `${k} = EXCLUDED.${k}`).join(',')}`,
      [runId, e.id, ...cols.map(k => slip[k])]
    );
  }

  private static async refreshTotals(c: PoolClient, runId: number) {
    await c.query(
      `UPDATE payroll_runs r 
       SET gross = t.g, deductions = t.d, net = t.n, employer_cost = t.g + t.er 
       FROM (
         SELECT COALESCE(SUM(gross), 0) g, COALESCE(SUM(total_deductions), 0) d, 
                COALESCE(SUM(net_pay), 0) n, COALESCE(SUM(pf_employer + esi_employer), 0) er
         FROM payslips 
         WHERE run_id = $1
       ) t 
       WHERE r.id = $1`,
      [runId]
    );
  }

  static async createRun(companyId: number, uid: number, period: string) {
    return tx(async c => {
      const p = period + '-01';
      const end = `${period}-${String(this.daysIn(period)).padStart(2, '0')}`;

      // Check if a payroll run for this period already exists
      const { rows: [existing] } = await c.query(
        `SELECT * FROM payroll_runs WHERE company_id = $1 AND period = $2`,
        [companyId, p]
      );

      if (existing) {
        if (existing.status === 'DRAFT') {
          // If already in draft, return existing run directly
          return existing;
        }
        throw new HttpError(
          409,
          `Payroll for ${period} has already been ${existing.status.toLowerCase()} (Run #${existing.id})`
        );
      }

      const { rows: [run] } = await c
        .query(
          `INSERT INTO payroll_runs(company_id, period, created_by) VALUES ($1, $2, $3) RETURNING *`,
          [companyId, p, uid]
        )
        .catch(e => {
          if (e.code === '23505') throw new HttpError(409, `Payroll for ${period} already exists`);
          throw e;
        });

      const s = await this.getSettings(c, companyId);
      const { rows: emps } = await c.query(
        `SELECT * FROM employees 
         WHERE company_id = $1 AND active = true AND join_date <= $3 
           AND (exit_date IS NULL OR exit_date >= $2) 
         ORDER BY emp_code`,
        [companyId, p, end]
      );

      if (!emps.length) throw new HttpError(422, 'No active employees for this month');

      const D = this.daysIn(period);
      for (const e of emps) {
        const startDay = e.join_date > p ? +e.join_date.slice(8) : 1;
        const endDay = e.exit_date && e.exit_date < end ? +e.exit_date.slice(8) : D;
        const lop = startDay - 1 + (D - endDay);

        await this.writeSlip(c, run.id, e, this.computeSlip(e, s, D, lop, 0, 0));
      }

      await this.refreshTotals(c, run.id);
      return run;
    });
  }

  static async updateSlip(
    companyId: number,
    runId: number,
    empId: number,
    d: { lop_days: number; bonus: number; other_deduction: number }
  ) {
    return tx(async c => {
      const { rows: [run] } = await c.query(
        `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [runId, companyId]
      );
      if (!run) throw new HttpError(404, 'Payroll run not found');
      if (run.status !== 'DRAFT') throw new HttpError(422, 'Only draft payroll can be changed');

      const { rows: [e] } = await c.query(
        `SELECT * FROM employees WHERE id = $1 AND company_id = $2`,
        [empId, companyId]
      );

      const period = run.period.slice(0, 7);
      const D = this.daysIn(period);
      if (d.lop_days < 0 || d.lop_days > D) {
        throw new HttpError(400, `Loss-of-pay days must be 0–${D}`);
      }

      const s = await this.getSettings(c, companyId);
      await this.writeSlip(
        c,
        runId,
        e,
        this.computeSlip(e, s, D, d.lop_days, d.bonus, d.other_deduction)
      );

      await this.refreshTotals(c, runId);
      return { ok: true };
    });
  }

  static async postRun(companyId: number, uid: number, runId: number) {
    return tx(async c => {
      const { rows: [run] } = await c.query(
        `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [runId, companyId]
      );
      if (!run) throw new HttpError(404, 'Not found');
      if (run.status !== 'DRAFT') throw new HttpError(422, `Payroll is already ${run.status}`);

      const { rows: [t] } = await c.query(
        `SELECT SUM(gross) g, SUM(pf_employee) pfe, SUM(pf_employer) pfr,
                SUM(esi_employee) ese, SUM(esi_employer) esr,
                SUM(pt) pt, SUM(tds) tds, SUM(other_deduction) od, SUM(net_pay) net 
         FROM payslips 
         WHERE run_id = $1`,
        [runId]
      );

      const n = (k: string) => Number(t[k] ?? 0);
      const period = run.period.slice(0, 7);
      const end = `${period}-${String(this.daysIn(period)).padStart(2, '0')}`;

      const je = await LedgerService.postJournal(c, companyId, uid, {
        date: end,
        source: 'PAYROLL',
        source_id: runId,
        narration: `Salary for ${period}`,
        lines: [
          { key: 'SALARY_EXP', debit: n('g') },
          { key: 'PF_EXP', debit: n('pfr') },
          { key: 'ESI_EXP', debit: n('esr') },
          { key: 'SAL_PAY', credit: n('net') },
          { key: 'PF_PAY', credit: n('pfe') + n('pfr') },
          { key: 'ESI_PAY', credit: n('ese') + n('esr') },
          { key: 'PT_PAY', credit: n('pt') },
          { key: 'TDS_SAL_PAY', credit: n('tds') },
          { key: 'ADVANCES', credit: n('od') },
        ],
      });

      await c.query(
        `UPDATE payroll_runs SET status = 'POSTED', journal_entry_id = $2 WHERE id = $1`,
        [runId, je]
      );

      return { entry_id: je };
    });
  }

  static async payRun(
    companyId: number,
    uid: number,
    runId: number,
    d: { bank_account_id: number; date: string }
  ) {
    return tx(async c => {
      const { rows: [run] } = await c.query(
        `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [runId, companyId]
      );
      if (!run) throw new HttpError(404, 'Not found');
      if (run.status !== 'POSTED') throw new HttpError(422, 'Post the payroll before paying it');

      const je = await LedgerService.postJournal(c, companyId, uid, {
        date: d.date,
        source: 'PAYROLL_PAYMENT',
        source_id: runId,
        narration: `Salary paid for ${run.period.slice(0, 7)}`,
        lines: [
          { key: 'SAL_PAY', debit: Number(run.net) },
          { account_id: d.bank_account_id, credit: Number(run.net) },
        ],
      });

      await c.query(
        `UPDATE payroll_runs SET status = 'PAID', payment_entry_id = $2 WHERE id = $1`,
        [runId, je]
      );

      return { entry_id: je };
    });
  }

  static async updateRun(companyId: number, runId: number, newPeriod: string) {
    return tx(async c => {
      const { rows: [run] } = await c.query(
        `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [runId, companyId]
      );
      if (!run) throw new HttpError(404, 'Payroll run not found');
      if (run.status !== 'DRAFT') {
        throw new HttpError(422, 'Only draft payroll runs can be edited');
      }

      const p = newPeriod + '-01';
      const end = `${newPeriod}-${String(this.daysIn(newPeriod)).padStart(2, '0')}`;

      // Check if another run already exists for this new period
      const { rows: [conflict] } = await c.query(
        `SELECT id FROM payroll_runs WHERE company_id = $1 AND period = $2 AND id <> $3`,
        [companyId, p, runId]
      );
      if (conflict) {
        throw new HttpError(
          409,
          `Another payroll run already exists for ${newPeriod} (Run #${conflict.id})`
        );
      }

      // Update the period
      await c.query(`UPDATE payroll_runs SET period = $1 WHERE id = $2`, [p, runId]);

      // Delete existing draft payslips to re-compute for the new period
      await c.query(`DELETE FROM payslips WHERE run_id = $1`, [runId]);

      const s = await this.getSettings(c, companyId);
      const { rows: emps } = await c.query(
        `SELECT * FROM employees 
         WHERE company_id = $1 AND active = true AND join_date <= $3 
           AND (exit_date IS NULL OR exit_date >= $2) 
         ORDER BY emp_code`,
        [companyId, p, end]
      );

      if (!emps.length) {
        throw new HttpError(422, `No active employees found for period ${newPeriod}`);
      }

      const D = this.daysIn(newPeriod);
      for (const e of emps) {
        const startDay = e.join_date > p ? +e.join_date.slice(8) : 1;
        const endDay = e.exit_date && e.exit_date < end ? +e.exit_date.slice(8) : D;
        const lop = startDay - 1 + (D - endDay);

        await this.writeSlip(c, runId, e, this.computeSlip(e, s, D, lop, 0, 0));
      }

      await this.refreshTotals(c, runId);
      return { ok: true, id: runId, period: p };
    });
  }

  static async deleteRun(companyId: number, uid: number, runId: number) {
    return tx(async c => {
      const { rows: [run] } = await c.query(
        `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [runId, companyId]
      );
      if (!run) throw new HttpError(404, 'Payroll run not found');

      if (run.status === 'PAID') {
        throw new HttpError(
          422,
          'Paid payroll runs cannot be deleted directly because salaries have already been disbursed via bank. Reverse payment entries first.'
        );
      }

      // If run was POSTED, reverse the ledger journal entry first to maintain double-entry integrity
      if (run.status === 'POSTED' && run.journal_entry_id) {
        const todayStr = new Date().toISOString().slice(0, 10);
        await LedgerService.reverseJournal(
          c,
          companyId,
          uid,
          Number(run.journal_entry_id),
          todayStr,
          `Reversal on payroll run deletion (Run #${runId}, Period: ${run.period})`
        );
      }

      // Delete payslips for this run
      await c.query(`DELETE FROM payslips WHERE run_id = $1`, [runId]);

      // Delete the payroll run
      await c.query(`DELETE FROM payroll_runs WHERE id = $1 AND company_id = $2`, [runId, companyId]);

      return { ok: true, id: runId, period: run.period };
    });
  }

  static async listRuns(companyId: number) {
    return query(
      `SELECT r.*, (SELECT COUNT(*) FROM payslips WHERE run_id = r.id) AS employees 
       FROM payroll_runs r 
       WHERE company_id = $1 
       ORDER BY period DESC`,
      [companyId]
    );
  }

  static async getRun(companyId: number, id: number) {
    const run = await one(
      `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (!run) throw new HttpError(404, 'Not found');

    const slips = await query(
      `SELECT s.*, e.emp_code, e.name, e.designation, e.department 
       FROM payslips s 
       JOIN employees e ON e.id = s.employee_id 
       WHERE run_id = $1 
       ORDER BY e.emp_code`,
      [id]
    );

    return { ...run, slips };
  }

  static async getPayslip(companyId: number, slipId: number, onlyUserId?: number) {
    const s = await one(
      `SELECT s.*, e.emp_code, e.name, e.designation, e.department, e.pan, e.uan, e.esi_no,
              e.bank_name, e.bank_acc_last4, e.join_date, e.user_id,
              r.period, r.status AS run_status, c.name AS company, c.legal_name, c.address
       FROM payslips s 
       JOIN employees e ON e.id = s.employee_id 
       JOIN payroll_runs r ON r.id = s.run_id 
       JOIN companies c ON c.id = r.company_id
       WHERE s.id = $1 AND r.company_id = $2`,
      [slipId, companyId]
    );

    if (!s || (onlyUserId && s.user_id !== onlyUserId)) {
      throw new HttpError(404, 'Payslip not found');
    }
    if (onlyUserId && s.run_status === 'DRAFT') {
      throw new HttpError(404, 'Payslip not released yet');
    }

    return s;
  }

  static async myPayslips(companyId: number, uid: number) {
    return query(
      `SELECT s.id, r.period, s.gross, s.total_deductions, s.net_pay, r.status 
       FROM payslips s 
       JOIN payroll_runs r ON r.id = s.run_id
       JOIN employees e ON e.id = s.employee_id 
       WHERE r.company_id = $1 AND e.user_id = $2 AND r.status <> 'DRAFT' 
       ORDER BY r.period DESC`,
      [companyId, uid]
    );
  }
}

