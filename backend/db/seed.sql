-- Base demo data (users, companies, masters). Password for all demo users: Admin@123
-- Transactions are created through the API by scripts/demo.mjs so every entry goes through the posting engine.
INSERT INTO users(name,email,password_hash) VALUES
 ('Naveen (Owner)','owner@fin.local',crypt('Admin@123',gen_salt('bf',10))),
 ('Accounts Manager','accounts@fin.local',crypt('Admin@123',gen_salt('bf',10))),
 ('HR Manager','hr@fin.local',crypt('Admin@123',gen_salt('bf',10))),
 ('Statutory Auditor','auditor@fin.local',crypt('Admin@123',gen_salt('bf',10))),
 ('Priya Verma','employee@fin.local',crypt('Admin@123',gen_salt('bf',10)));

SELECT create_company('LedgerFinance Technologies Pvt Ltd','IT_SOFTWARE','23',1);   -- company 1
SELECT create_company('Sunrise Retail Mart','RETAIL','23',1);                    -- company 2 (different industry COA)
INSERT INTO memberships VALUES (1,2,'ACCOUNTANT'),(1,3,'HR'),(1,4,'AUDITOR'),(1,5,'EMPLOYEE'),(2,2,'ACCOUNTANT');
UPDATE users SET last_company_id = 1;
UPDATE companies SET legal_name='LedgerFinance Technologies Private Limited', gstin='23AAACB1234C1Z5', pan='AAACB1234C',
  address='Plot 12, IT Park, Pardesipura, Indore, Madhya Pradesh 452010', email='accounts@LedgerFinance.example', phone='0731-4000000' WHERE id=1;
UPDATE companies SET gstin='23AAGCS7788K1Z2', address='MG Road, Satna, Madhya Pradesh 485001' WHERE id=2;
UPDATE accounts SET name='HDFC Bank – Current A/c', bank_name='HDFC Bank', bank_acc_last4='4417', ifsc='HDFC0001234' WHERE company_id=1 AND code='1110';
INSERT INTO accounts(company_id,code,name,type,subtype,bank_name,bank_acc_last4) VALUES (1,'1111','ICICI Bank – Payroll A/c','ASSET','BANK','ICICI Bank','9021');

INSERT INTO parties(company_id,name,kind,gstin,state_code,address,email,credit_days) VALUES
 (1,'Acme Corp India Pvt Ltd','CUSTOMER','27AABCA1234D1Z1','27','Andheri East, Mumbai','ap@acme.example',30),
 (1,'Globex Retail Ltd','CUSTOMER','23AAGCG5678E1Z3','23','Vijay Nagar, Indore','finance@globex.example',15),
 (1,'City Care Hospital','CUSTOMER',NULL,'23','Bhopal','admin@citycare.example',15),
 (1,'Infotech Solutions LLP','CUSTOMER','29AAFCI9012F1Z8','29','Whitefield, Bengaluru','pay@infotech.example',45),
 (1,'Amazon Web Services India','VENDOR','27AAACA0000A1Z2','27','Mumbai','billing@aws.example',30),
 (1,'Dell India Pvt Ltd','VENDOR','29AAACD1111B1Z9','29','Bengaluru','orders@dell.example',30),
 (1,'Bharat Telecom Ltd','VENDOR','23AABCB2222C1Z4','23','Indore',NULL,15),
 (1,'R. Sharma (Landlord)','VENDOR',NULL,'23','Indore',NULL,5);

INSERT INTO items(company_id,name,kind,hsn_sac,unit,sale_price,purchase_price,gst_rate,income_account_id,expense_account_id) VALUES
 (1,'Custom Software Development','SERVICE','998314','HRS',2500,0,18,(SELECT id FROM accounts WHERE company_id=1 AND code='4110'),NULL),
 (1,'SaaS Subscription – Pro','SERVICE','998315','USER',950,0,18,(SELECT id FROM accounts WHERE company_id=1 AND code='4120'),NULL),
 (1,'Annual Maintenance & Support','SERVICE','998713','NOS',25000,0,18,(SELECT id FROM accounts WHERE company_id=1 AND code='4130'),NULL),
 (1,'Cloud Hosting','SERVICE','998315','NOS',0,38000,18,NULL,(SELECT id FROM accounts WHERE company_id=1 AND code='5110')),
 (1,'Laptop – Latitude 7450','GOODS','847130','NOS',0,85000,18,NULL,(SELECT id FROM accounts WHERE company_id=1 AND code='1510'));

INSERT INTO employees(company_id,emp_code,name,user_id,designation,department,pan,uan,join_date,basic,hra,special,other_allow,monthly_tds,bank_name,bank_acc_last4) VALUES
 (1,'E001','Anita Desai',NULL,'Engineering Manager','Engineering','ABCPD1234E','100200300401','2023-06-01',60000,24000,16000,0,8500,'HDFC Bank','1101'),
 (1,'E002','Rahul Mehta',NULL,'Senior Developer','Engineering','BCDPM2345F','100200300402','2024-01-15',20000,8000,4000,0,0,'SBI','2202'),
 (1,'E003','Priya Verma',5,'QA Engineer','Engineering','CDEPV3456G','100200300403','2025-03-01',10000,4000,4000,0,0,'ICICI Bank','3303'),
 (1,'E004','Vikram Singh',NULL,'Sales Executive','Sales','DEFPS4567H','100200300404','2024-08-01',15000,5000,15000,0,0,'Axis Bank','4404'),
 (1,'E005','Neha Patel',NULL,'Accounts Assistant','Finance','EFGPP5678J','100200300405','2026-07-16',12000,4800,3000,0,0,'HDFC Bank','5505');
UPDATE employees SET esi_no='3100'||lpad(id::text,6,'0') WHERE basic+hra+special+other_allow <= 21000;
