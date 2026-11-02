import { query, one } from '../config/database.js';

export class AccountRepository {
  static async listWithBalances(companyId: number) {
    return query(
      `SELECT a.*, COALESCE(SUM(l.debit - l.credit), 0) AS balance 
       FROM accounts a 
       LEFT JOIN journal_lines l ON l.account_id = a.id
       WHERE a.company_id = $1 
       GROUP BY a.id 
       ORDER BY a.code`,
      [companyId]
    );
  }

  static async findById(companyId: number, id: number) {
    return one(
      `SELECT * FROM accounts WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
  }

  static async findBySystemKey(companyId: number, systemKey: string) {
    return one(
      `SELECT id FROM accounts WHERE company_id = $1 AND system_key = $2`,
      [companyId, systemKey]
    );
  }

  static async create(companyId: number, data: any) {
    const cols = ['code', 'name', 'type', 'subtype', 'bank_name', 'bank_acc_last4', 'ifsc', 'active'];
    const activeCols = cols.filter(k => data[k] !== undefined);
    return one(
      `INSERT INTO accounts(company_id, ${activeCols.join(',')})
       VALUES ($1, ${activeCols.map((_, i) => `$${i + 2}`).join(',')})
       RETURNING *`,
      [companyId, ...activeCols.map(k => data[k])]
    );
  }

  static async update(companyId: number, id: number, data: any) {
    const cols = ['code', 'name', 'type', 'subtype', 'bank_name', 'bank_acc_last4', 'ifsc', 'active'];
    const activeCols = cols.filter(k => data[k] !== undefined);
    if (!activeCols.length) return null;

    return one(
      `UPDATE accounts 
       SET ${activeCols.map((k, i) => `${k} = $${i + 3}`).join(', ')} 
       WHERE company_id = $1 AND id = $2 
       RETURNING *`,
      [companyId, id, ...activeCols.map(k => data[k])]
    );
  }
}

