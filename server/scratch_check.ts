import { PrismaClient } from '@prisma/client';
import { calculateApplicationScores } from './src/lib/scoreEngine';

const prisma = new PrismaClient();

async function main() {
  const appId = "5ddcaac0-b5bd-4c9c-a40e-082eee4dcd59";
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { faculty: true }
  });

  if (!app) {
    console.error('Application not found');
    return;
  }

  console.log(`Faculty: ${app.faculty.name}, Designation: ${app.faculty.designation}`);
  
  const results = await calculateApplicationScores(appId, app.faculty.designation!);
  console.log('--- SCORE CALCULATION RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
