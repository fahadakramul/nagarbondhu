import { db } from '../src/db';
import { RAJSHAHI_WARDS } from '@nagarbondhu/shared';

async function main() {
  console.log('Seeding NagarBondhu AI Database for Rajshahi, Bangladesh...');

  // Reset / ensure seeded
  db.seedDefaultData();

  const wards = db.getAllWards();
  const reports = db.findReports({ limit: 100 });
  const admin = db.findUserByEmail('admin@nagarbondhu.gov.bd');
  const citizen = db.findUserByEmail('citizen@rajshahi.test');

  console.log(`✅ Seeded ${wards.length} Rajshahi Wards.`);
  console.log(`✅ Demo Admin Account: admin@nagarbondhu.gov.bd / DemoAdmin123!`);
  console.log(`✅ Demo Citizen Account: citizen@rajshahi.test / Citizen123!`);
  console.log(`✅ Seeded ${reports.total} Realistic Civic Reports across Rajshahi with AI analysis and priority assessments.`);
  console.log(`✅ Seeded Duplicate Detection pair: 'rep-001' and 'rep-002' at Shaheb Bazar.`);
  console.log('Database seeding successfully finished!');
}

main().catch((e) => {
  console.error('Seeding error:', e);
  process.exit(1);
});
