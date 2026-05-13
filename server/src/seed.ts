import { PrismaClient, Role, Designation, ScoringSection } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── DEPARTMENTS ────────────────────────────────────────────────────────────
  const departments = [
    { name: 'Computer Science & Engineering', code: 'CSE' },
    { name: 'Information Science & Engineering', code: 'ISE' },
    { name: 'Electronics & Communication Engineering', code: 'ECE' },
    { name: 'Electrical & Electronics Engineering', code: 'EEE' },
    { name: 'Mechanical Engineering', code: 'ME' },
    { name: 'Civil Engineering', code: 'CE' },
    { name: 'Chemical Engineering', code: 'CHE' },
    { name: 'Industrial Engineering & Management', code: 'IEM' },
    { name: 'Biotechnology', code: 'BT' },
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Physics', code: 'PHY' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'Architecture', code: 'ARCH' },
    { name: 'Master of Computer Applications', code: 'MCA' },
    { name: 'MBA', code: 'MBA' },
  ];

  const createdDepts: Record<string, string> = {};
  for (const dept of departments) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
    createdDepts[dept.code] = d.id;
  }
  console.log(`✅ ${departments.length} departments seeded`);

  // ─── USERS ──────────────────────────────────────────────────────────────────
  const defaultPassword = await bcrypt.hash('Admin@123', 10);

  const users = [
    { email: 'admin@rit.edu', name: 'System Admin', role: Role.ADMIN, department_id: createdDepts['CSE'] },
    { email: 'principal@rit.edu', name: 'Dr. Principal', role: Role.PRINCIPAL, department_id: createdDepts['CSE'] },
    { email: 'hod.cse@rit.edu', name: 'Dr. HOD CSE', role: Role.HOD, department_id: createdDepts['CSE'] },
    { email: 'faculty.cse@rit.edu', name: 'Dr. Faculty CSE', role: Role.FACULTY, department_id: createdDepts['CSE'], designation: Designation.ASSISTANT_PROFESSOR },
    { email: 'reviewer@rit.edu', name: 'Dr. Reviewer', role: Role.REVIEWER, department_id: createdDepts['CSE'] },
    { email: 'accounts@rit.edu', name: 'Accounts Officer', role: Role.ACCOUNTS, department_id: createdDepts['CSE'] },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        password_hash: defaultPassword,
      },
    });
  }
  console.log(`✅ ${users.length} users seeded (password: Admin@123)`);

  // ─── SCORING CATEGORIES ─────────────────────────────────────────────────────
  const categories = [
    // TEACHING (1-8)
    { sl_no: 1, section: ScoringSection.TEACHING, name: 'FCI Score', input_type: 'percentage', description: 'Faculty Course Index from student feedback' },
    { sl_no: 2, section: ScoringSection.TEACHING, name: 'Course Material Preparation', input_type: 'number', description: 'Quality of course materials, lesson plans, and lab manuals' },
    { sl_no: 3, section: ScoringSection.TEACHING, name: 'Remedial Coaching', input_type: 'number', description: 'Extra classes and remedial sessions conducted' },
    { sl_no: 4, section: ScoringSection.TEACHING, name: 'Innovative Teaching Methods', input_type: 'number', description: 'Use of ICT, flipped classrooms, project-based learning' },
    { sl_no: 5, section: ScoringSection.TEACHING, name: 'Examination Results', input_type: 'percentage', description: 'Pass percentage and improvement in results' },
    { sl_no: 6, section: ScoringSection.TEACHING, name: 'Student Projects Guided', input_type: 'number', description: 'UG/PG projects and dissertations guided' },
    { sl_no: 7, section: ScoringSection.TEACHING, name: 'Content Beyond Syllabus', input_type: 'number', description: 'Additional topics, certifications, and value-added courses' },
    { sl_no: 8, section: ScoringSection.TEACHING, name: 'Lab Development', input_type: 'number', description: 'New experiments, lab manual updates, equipment setup' },

    // RESEARCH (9-17)
    { sl_no: 9, section: ScoringSection.RESEARCH, name: 'Journal Publications (SCI/Scopus)', input_type: 'number', description: 'Research papers in SCI/Scopus indexed journals' },
    { sl_no: 10, section: ScoringSection.RESEARCH, name: 'Conference Publications', input_type: 'number', description: 'Papers in national/international conferences' },
    { sl_no: 11, section: ScoringSection.RESEARCH, name: 'Books/Book Chapters Published', input_type: 'number', description: 'Authored/co-authored books or book chapters' },
    { sl_no: 12, section: ScoringSection.RESEARCH, name: 'Patents Filed/Granted', input_type: 'number', description: 'Patents filed, published, or granted' },
    { sl_no: 13, section: ScoringSection.RESEARCH, name: 'Funded Research Projects', input_type: 'currency_slab', description: 'Research grants received from funding agencies' },
    { sl_no: 14, section: ScoringSection.RESEARCH, name: 'Consultancy Projects', input_type: 'currency_slab', description: 'Industry consultancy and sponsored projects' },
    { sl_no: 15, section: ScoringSection.RESEARCH, name: 'PhD Scholars Guided', input_type: 'number', description: 'Research scholars guided as supervisor/co-supervisor' },
    { sl_no: 16, section: ScoringSection.RESEARCH, name: 'Research Guidance (M.Tech)', input_type: 'number', description: 'M.Tech dissertations supervised' },
    { sl_no: 17, section: ScoringSection.RESEARCH, name: 'Citation Index / h-index', input_type: 'number', description: 'Google Scholar h-index and citation metrics' },

    // SERVICE (18-23)
    { sl_no: 18, section: ScoringSection.SERVICE, name: 'Administrative Responsibilities', input_type: 'composite', description: 'Dean, Controller of Exams, Warden, etc.' },
    { sl_no: 19, section: ScoringSection.SERVICE, name: 'Committee Memberships', input_type: 'number', description: 'Institutional committees, BOS, Academic Council' },
    { sl_no: 20, section: ScoringSection.SERVICE, name: 'FDP/Workshop Organized', input_type: 'number', description: 'Faculty development programs and workshops organized' },
    { sl_no: 21, section: ScoringSection.SERVICE, name: 'FDP/Workshop Attended', input_type: 'number', description: 'Professional development programs attended' },
    { sl_no: 22, section: ScoringSection.SERVICE, name: 'Community Service & Outreach', input_type: 'number', description: 'Social outreach, NSS, rural programs' },
    { sl_no: 23, section: ScoringSection.SERVICE, name: 'Professional Body Membership', input_type: 'number', description: 'IEEE, ACM, CSI, ISTE memberships and activities' },
  ];

  const createdCategories: Record<number, string> = {};
  for (const cat of categories) {
    const c = await prisma.scoringCategory.upsert({
      where: { id: `cat-${cat.sl_no}` },
      update: {},
      create: {
        id: `cat-${cat.sl_no}`,
        ...cat,
      },
    });
    createdCategories[cat.sl_no] = c.id;
  }
  console.log(`✅ ${categories.length} scoring categories seeded`);

  // ─── SCORING RULES (3 designations × 23 categories = 69 rules) ─────────────
  const designations = [Designation.ASSISTANT_PROFESSOR, Designation.ASSOCIATE_PROFESSOR, Designation.PROFESSOR];

  const maxWeightages: Record<number, Record<Designation, number>> = {
    // TEACHING
    1:  { ASSISTANT_PROFESSOR: 15, ASSOCIATE_PROFESSOR: 12, PROFESSOR: 10 },
    2:  { ASSISTANT_PROFESSOR: 10, ASSOCIATE_PROFESSOR: 8,  PROFESSOR: 5 },
    3:  { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 2 },
    4:  { ASSISTANT_PROFESSOR: 8,  ASSOCIATE_PROFESSOR: 8,  PROFESSOR: 5 },
    5:  { ASSISTANT_PROFESSOR: 12, ASSOCIATE_PROFESSOR: 10, PROFESSOR: 8 },
    6:  { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 8,  PROFESSOR: 10 },
    7:  { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 5 },
    8:  { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 2 },
    // RESEARCH
    9:  { ASSISTANT_PROFESSOR: 8,  ASSOCIATE_PROFESSOR: 12, PROFESSOR: 15 },
    10: { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 5 },
    11: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 8 },
    12: { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 8,  PROFESSOR: 10 },
    13: { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 8,  PROFESSOR: 12 },
    14: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 8 },
    15: { ASSISTANT_PROFESSOR: 2,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 10 },
    16: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 5 },
    17: { ASSISTANT_PROFESSOR: 2,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 5 },
    // SERVICE
    18: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 8 },
    19: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 5 },
    20: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 5,  PROFESSOR: 5 },
    21: { ASSISTANT_PROFESSOR: 5,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 3 },
    22: { ASSISTANT_PROFESSOR: 3,  ASSOCIATE_PROFESSOR: 3,  PROFESSOR: 3 },
    23: { ASSISTANT_PROFESSOR: 2,  ASSOCIATE_PROFESSOR: 2,  PROFESSOR: 2 },
  };

  let ruleCount = 0;
  for (const slNo of Object.keys(maxWeightages).map(Number)) {
    for (const designation of designations) {
      const maxW = maxWeightages[slNo][designation];
      await prisma.scoringRule.upsert({
        where: {
          category_id_designation: {
            category_id: createdCategories[slNo],
            designation,
          },
        },
        update: {},
        create: {
          category_id: createdCategories[slNo],
          designation,
          max_weightage: maxW,
          formula: {
            type: 'linear',
            max: maxW,
            description: `Up to ${maxW} marks based on evidence`,
          },
        },
      });
      ruleCount++;
    }
  }
  console.log(`✅ ${ruleCount} scoring rules seeded`);

  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
