import { query, one } from '../config/database.js';

export class CompanyRepository {
  static async findById(id: number) {
    return one(`SELECT * FROM companies WHERE id = $1`, [id]);
  }

  static async update(id: number, data: any) {
    return one(
      `UPDATE companies 
       SET name = $2, legal_name = $3, industry = $4, gstin = $5, pan = $6, 
           state_code = $7, address = $8, email = $9, phone = $10,
           lock_date = $11, payroll_settings = COALESCE($12, payroll_settings) 
       WHERE id = $1 
       RETURNING *`,
      [
        id,
        data.name,
        data.legal_name,
        data.industry,
        data.gstin,
        data.pan,
        data.state_code,
        data.address,
        data.email,
        data.phone,
        data.lock_date,
        data.payroll_settings ? JSON.stringify(data.payroll_settings) : null,
      ]
    );
  }

  static async listUserCompanies(userId: number) {
    return query(
      `SELECT c.id, c.name, c.industry, c.gstin, m.role 
       FROM memberships m 
       JOIN companies c ON c.id = m.company_id 
       WHERE m.user_id = $1 
       ORDER BY c.name`,
      [userId]
    );
  }

  static async getFiscalYears(companyId: number) {
    return query(
      `SELECT * FROM fiscal_years WHERE company_id = $1 ORDER BY start_date DESC`,
      [companyId]
    );
  }

  static async listMembers(companyId: number) {
    return query(
      `SELECT u.id, u.name, u.email, m.role, m.permissions 
       FROM memberships m 
       JOIN users u ON u.id = m.user_id 
       WHERE m.company_id = $1 
       ORDER BY m.role, u.name`,
      [companyId]
    );
  }
}

