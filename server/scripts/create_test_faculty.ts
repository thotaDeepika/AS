import { PrismaClient, Role, Designation } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();

async function main() {
  const email = 'test.faculty@rit.edu';
  const name = 'Dr. Test Faculty';
  const password = 'Password@123';
  
  const dept = await prisma.department.findFirst({ where: { code: 'CSE' } });
  if (!dept) {
    console.log('CSE department not found. Please seed the DB first.');
    return;
  }

  const defaultPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password_hash: defaultPassword,
    },
    create: {
      email,
      name,
      role: Role.FACULTY,
      department_id: dept.id,
      designation: Designation.ASSISTANT_PROFESSOR,
      password_hash: defaultPassword,
    },
  });

  console.log(`✅ Test faculty created successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
