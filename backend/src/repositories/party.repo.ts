import { query, one } from '../config/database.js';

export class PartyRepository {
  static async list(companyId: number, kind?: string) {
    if (kind) {
      return query(
        `SELECT * FROM parties WHERE company_id = $1 AND (kind = $2 OR kind = 'BOTH') ORDER BY name`,
        [companyId, kind]
      );
    }
    return query(
      `SELECT * FROM parties WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );
  }

  static async findById(companyId: number, id: number) {
    return one(
      `SELECT * FROM parties WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
  }

  static async create(companyId: number, data: any) {
    const cols = ['name', 'kind', 'gstin', 'pan', 'state_code', 'address', 'email', 'phone', 'credit_days'];
    const activeCols = cols.filter(k => data[k] !== undefined);
    return one(
      `INSERT INTO parties(company_id, ${activeCols.join(',')})
       VALUES ($1, ${activeCols.map((_, i) => `$${i + 2}`).join(',')})
       RETURNING *`,
      [companyId, ...activeCols.map(k => data[k])]
    );
  }

  static async update(companyId: number, id: number, data: any) {
    const cols = ['name', 'kind', 'gstin', 'pan', 'state_code', 'address', 'email', 'phone', 'credit_days'];
    const activeCols = cols.filter(k => data[k] !== undefined);
    if (!activeCols.length) return null;

    return one(
      `UPDATE parties 
       SET ${activeCols.map((k, i) => `${k} = $${i + 3}`).join(', ')} 
       WHERE company_id = $1 AND id = $2 
       RETURNING *`,
      [companyId, id, ...activeCols.map(k => data[k])]
    );
  }
}

