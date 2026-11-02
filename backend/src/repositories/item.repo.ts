import { query, one } from '../config/database.js';

export class ItemRepository {
  static async list(companyId: number) {
    return query(
      `SELECT * FROM items WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );
  }

  static async findById(companyId: number, id: number) {
    return one(
      `SELECT * FROM items WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
  }

  static async create(companyId: number, data: any) {
    const cols = [
      'name',
      'kind',
      'hsn_sac',
      'unit',
      'sale_price',
      'purchase_price',
      'gst_rate',
      'income_account_id',
      'expense_account_id',
      'active',
    ];
    const activeCols = cols.filter(k => data[k] !== undefined);
    return one(
      `INSERT INTO items(company_id, ${activeCols.join(',')})
       VALUES ($1, ${activeCols.map((_, i) => `$${i + 2}`).join(',')})
       RETURNING *`,
      [companyId, ...activeCols.map(k => data[k])]
    );
  }

  static async update(companyId: number, id: number, data: any) {
    const cols = [
      'name',
      'kind',
      'hsn_sac',
      'unit',
      'sale_price',
      'purchase_price',
      'gst_rate',
      'income_account_id',
      'expense_account_id',
      'active',
    ];
    const activeCols = cols.filter(k => data[k] !== undefined);
    if (!activeCols.length) return null;

    return one(
      `UPDATE items 
       SET ${activeCols.map((k, i) => `${k} = $${i + 3}`).join(', ')} 
       WHERE company_id = $1 AND id = $2 
       RETURNING *`,
      [companyId, id, ...activeCols.map(k => data[k])]
    );
  }
}

