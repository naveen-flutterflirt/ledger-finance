import { query, one } from '../config/database.js';

export class EmployeeRepository {
  static async list(companyId: number) {
    return query(
      `SELECT * FROM employees WHERE company_id = $1 ORDER BY emp_code`,
      [companyId]
    );
  }

  static async findById(companyId: number, id: number) {
    return one(
      `SELECT * FROM employees WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
  }

  static async create(companyId: number, data: any) {
    const cols = [
      'emp_code',
      'name',
      'user_id',
      'designation',
      'department',
      'pan',
      'uan',
      'esi_no',
      'bank_name',
      'bank_acc_last4',
      'join_date',
      'exit_date',
      'basic',
      'hra',
      'special',
      'other_allow',
      'pf_applicable',
      'esi_applicable',
      'pt_applicable',
      'monthly_tds',
      'active',
    ];
    const activeCols = cols.filter(k => data[k] !== undefined);
    return one(
      `INSERT INTO employees(company_id, ${activeCols.join(',')})
       VALUES ($1, ${activeCols.map((_, i) => `$${i + 2}`).join(',')})
       RETURNING *`,
      [companyId, ...activeCols.map(k => data[k])]
    );
  }

  static async update(companyId: number, id: number, data: any) {
    const cols = [
      'emp_code',
      'name',
      'user_id',
      'designation',
      'department',
      'pan',
      'uan',
      'esi_no',
      'bank_name',
      'bank_acc_last4',
      'join_date',
      'exit_date',
      'basic',
      'hra',
      'special',
      'other_allow',
      'pf_applicable',
      'esi_applicable',
      'pt_applicable',
      'monthly_tds',
      'active',
    ];
    const activeCols = cols.filter(k => data[k] !== undefined);
    if (!activeCols.length) return null;

    return one(
      `UPDATE employees 
       SET ${activeCols.map((k, i) => `${k} = $${i + 3}`).join(', ')} 
       WHERE company_id = $1 AND id = $2 
       RETURNING *`,
      [companyId, id, ...activeCols.map(k => data[k])]
    );
  }
}

