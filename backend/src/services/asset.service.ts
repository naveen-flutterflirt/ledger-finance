import { PoolClient } from 'pg';
import { query, one, tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { LedgerService } from './ledger.service.js';
import { r2 } from '../utils/money.js';

export class AssetService {
  private static async accumulated(c: PoolClient, assetId: number): Promise<number> {
    const { rows: [r] } = await c.query(
      `SELECT COALESCE(SUM(amount), 0) AS v FROM depreciation_entries WHERE asset_id = $1`,
      [assetId]
    );
    return Number(r.v);
  }

  private static monthlyCharge(a: any, acc: number, periodStart: Date): number {
    const cost = Number(a.cost);
    const salvage = Number(a.salvage_value);
    const book = r2(cost - acc);
    const room = r2(book - salvage);
    if (room <= 0) return 0;

    const monthEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0));
    const use = new Date(a.put_to_use_date + 'T00:00:00Z');
    if (use > monthEnd) return 0;

    const days = monthEnd.getUTCDate();
    const factor = use >= periodStart ? (days - use.getUTCDate() + 1) / days : 1;

    const base =
      a.method === 'SLM'
        ? (cost - salvage) / (Number(a.useful_life_years) * 12)
        : (book * Number(a.wdv_rate)) / 100 / 12;

    return Math.min(r2(base * factor), room);
  }

  static async createAsset(companyId: number, uid: number, d: any) {
    return tx(async c => {
      const { rows: [fa] } = await c.query(
        `SELECT subtype FROM accounts WHERE id = $1 AND company_id = $2`,
        [d.asset_account_id, companyId]
      );
      if (!fa || fa.subtype !== 'FIXED_ASSET') {
        throw new HttpError(422, 'Asset account must be a fixed-asset account');
      }

      const accDep = (
        await c.query(`SELECT id FROM accounts WHERE company_id = $1 AND system_key = 'ACC_DEP'`, [companyId])
      ).rows[0].id;

      const depExp = (
        await c.query(`SELECT id FROM accounts WHERE company_id = $1 AND system_key = 'DEP_EXP'`, [companyId])
      ).rows[0].id;

      const { rows: [a] } = await c.query(
        `INSERT INTO fixed_assets(company_id, asset_no, name, category, asset_account_id, 
                                  acc_dep_account_id, dep_expense_account_id, purchase_date, 
                                  put_to_use_date, cost, salvage_value, method, useful_life_years, 
                                  wdv_rate, bill_id)
         VALUES ($1, next_doc_no($1, 'FA', $7), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
         RETURNING *`,
        [
          companyId,
          d.name,
          d.category,
          d.asset_account_id,
          accDep,
          depExp,
          d.purchase_date,
          d.put_to_use_date ?? d.purchase_date,
          d.cost,
          d.salvage_value ?? 0,
          d.method,
          d.method === 'SLM' ? d.useful_life_years : null,
          d.method === 'WDV' ? d.wdv_rate : null,
          d.funding === 'BILL' ? d.bill_id : null,
        ]
      );

      if (d.funding === 'BANK') {
        await LedgerService.postJournal(c, companyId, uid, {
          date: d.purchase_date,
          source: 'ASSET_PURCHASE',
          source_id: a.id,
          narration: `Purchase of asset ${a.asset_no} ${d.name}`,
          lines: [
            { account_id: d.asset_account_id, debit: d.cost },
            { account_id: d.paid_from_account_id, credit: d.cost },
          ],
        });
      }

      if (d.funding === 'OPENING') {
        const od = d.opening_acc_dep ?? 0;
        await LedgerService.postJournal(c, companyId, uid, {
          date: d.opening_date,
          source: 'OPENING',
          source_id: a.id,
          narration: `Opening balance of asset ${a.asset_no}`,
          lines: [
            { account_id: d.asset_account_id, debit: d.cost },
            { key: 'ACC_DEP', credit: od },
            { key: 'OBE', credit: r2(d.cost - od) },
          ],
        });

        if (od > 0) {
          await c.query(
            `INSERT INTO depreciation_entries(asset_id, period, amount) 
             VALUES ($1, date_trunc('month', $2::date), $3)`,
            [a.id, d.opening_date, od]
          );
        }
      }

      return a;
    });
  }

  static async runDepreciation(companyId: number, uid: number, period: string) {
    return tx(async c => {
      const start = new Date(period + '-01T00:00:00Z');
      const periodDate = period + '-01';
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);

      const { rows: assets } = await c.query(
        `SELECT * FROM fixed_assets a 
         WHERE company_id = $1 AND status = 'ACTIVE' AND put_to_use_date <= $2
           AND NOT EXISTS (SELECT 1 FROM depreciation_entries d WHERE d.asset_id = a.id AND d.period = $3) 
         FOR UPDATE`,
        [companyId, end, periodDate]
      );

      const charges: { a: any; amt: number }[] = [];
      for (const a of assets) {
        const amt = this.monthlyCharge(a, await this.accumulated(c, a.id), start);
        if (amt > 0) charges.push({ a, amt });
      }

      if (!charges.length) return { posted: 0, total: 0 };

      const lines = charges.flatMap(({ a, amt }) => [
        { account_id: a.dep_expense_account_id, debit: amt, narration: `${a.asset_no} ${a.name}` },
        { account_id: a.acc_dep_account_id, credit: amt, narration: `${a.asset_no} ${a.name}` },
      ]);

      const je = await LedgerService.postJournal(c, companyId, uid, {
        date: end,
        source: 'DEPRECIATION',
        narration: `Depreciation for ${period}`,
        lines,
      });

      for (const { a, amt } of charges) {
        await c.query(
          `INSERT INTO depreciation_entries(asset_id, period, amount, journal_entry_id) 
           VALUES ($1, $2, $3, $4)`,
          [a.id, periodDate, amt, je]
        );
      }

      return {
        posted: charges.length,
        total: r2(charges.reduce((s, x) => s + x.amt, 0)),
        entry_id: je,
      };
    });
  }

  static async disposeAsset(
    companyId: number,
    uid: number,
    id: number,
    d: { date: string; sale_amount: number; account_id?: number }
  ) {
    return tx(async c => {
      const { rows: [a] } = await c.query(
        `SELECT * FROM fixed_assets WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [id, companyId]
      );
      if (!a) throw new HttpError(404, 'Not found');
      if (a.status !== 'ACTIVE') throw new HttpError(422, 'Asset already disposed');

      if (d.sale_amount > 0 && !d.account_id) {
        throw new HttpError(400, 'Choose the bank/cash account that received the sale amount');
      }

      const acc = await this.accumulated(c, id);
      const cost = Number(a.cost);
      const book = r2(cost - acc);
      const gain = r2(d.sale_amount - book);

      await LedgerService.postJournal(c, companyId, uid, {
        date: d.date,
        source: 'ASSET_DISPOSAL',
        source_id: id,
        narration: `Disposal of ${a.asset_no} ${a.name}`,
        lines: [
          { account_id: d.account_id, debit: d.sale_amount },
          { account_id: a.acc_dep_account_id, debit: acc },
          { account_id: a.asset_account_id, credit: cost },
          gain >= 0
            ? { key: 'GAIN_DISPOSAL', credit: gain }
            : { key: 'LOSS_DISPOSAL', debit: -gain },
        ],
      });

      await c.query(
        `UPDATE fixed_assets SET status = 'DISPOSED', disposed_on = $2, sale_amount = $3 WHERE id = $1`,
        [id, d.date, d.sale_amount]
      );

      return { book_value: book, gain };
    });
  }

  static async assetRegister(companyId: number) {
    return query(
      `SELECT a.*, ac.name AS asset_account, COALESCE(d.acc, 0) AS accumulated_dep, 
              a.cost - COALESCE(d.acc, 0) AS book_value, d.last_period
       FROM fixed_assets a 
       JOIN accounts ac ON ac.id = a.asset_account_id
       LEFT JOIN (
         SELECT asset_id, SUM(amount) acc, MAX(period) last_period 
         FROM depreciation_entries 
         GROUP BY asset_id
       ) d ON d.asset_id = a.id
       WHERE a.company_id = $1 
       ORDER BY a.status, a.asset_no`,
      [companyId]
    );
  }

  static async assetSchedule(companyId: number, id: number) {
    const a = await one(
      `SELECT * FROM fixed_assets WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (!a) throw new HttpError(404, 'Not found');

    const entries = await query(
      `SELECT * FROM depreciation_entries WHERE asset_id = $1 ORDER BY period`,
      [id]
    );

    return { ...a, entries };
  }
}

