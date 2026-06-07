import { PrismaClient, Role, Designation, ScoringSection } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── DEPARTMENTS ────────────────────────────────────────────────────────────
  const departments = [
    { name: 'Aerospace Engineering', code: 'AERO' },
    { name: 'Architecture', code: 'ARCH' },
    { name: 'Artificial Intelligence & Data Science', code: 'AIDS' },
    { name: 'Artificial Intelligence & Machine Learning', code: 'AIML' },
    { name: 'Biotechnology', code: 'BT' },
    { name: 'Chemical Engineering', code: 'CHE' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'Civil Engineering', code: 'CE' },
    { name: 'Computer Science & Engineering', code: 'CSE' },
    { name: 'Computer Science & Engineering (AI & ML)', code: 'CSE-AIML' },
    { name: 'Computer Science & Engineering (Cyber Security)', code: 'CSE-CY' },
    { name: 'Electronics & Communication Engineering', code: 'ECE' },
    { name: 'Electronics & Instrumentation Engineering', code: 'EIE' },
    { name: 'Electrical & Electronics Engineering', code: 'EEE' },
    { name: 'Electronics & Telecommunication Engineering', code: 'ETE' },
    { name: 'Humanities', code: 'HUM' },
    { name: 'Industrial Engineering & Management', code: 'IEM' },
    { name: 'Information Science & Engineering', code: 'ISE' },
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Master of Computer Applications (MCA)', code: 'MCA' },
    { name: 'Management Studies (MBA)', code: 'MBA' },
    { name: 'Mechanical Engineering', code: 'ME' },
    { name: 'Medical Electronics Engineering', code: 'MLE' },
    { name: 'Physics', code: 'PHY' },
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

  // ─── SCORING CATEGORIES (Strictly per FINAL_SCORING.md) ────────────────────
  //
  // TEACHING: 1 category  (sl_no 1)
  // RESEARCH: 11 categories (sl_no 2-12)
  // SERVICE:  11 categories (sl_no 13-23)

  const categories = [
    // ── TEACHING ──
    {
      sl_no: 1,
      section: ScoringSection.TEACHING,
      name: 'FCI Score',
      description: 'Average FCI Score of all courses handled (percentage)',
      input_type: 'percentage',
      input_config: { max_attachments: 1, field: 'fci_percentage' },
    },

    // ── RESEARCH ──
    {
      sl_no: 2,
      section: ScoringSection.RESEARCH,
      name: 'Non-paid Refereed Journal Papers in SJR/Scopus/Web of Science',
      description: 'Faculty must be one among first 3 authors. 1 paper = 100% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 2, field: 'count' },
    },
    {
      sl_no: 3,
      section: ScoringSection.RESEARCH,
      name: 'Indexed Conference Papers in SJR/Scopus/Web of Science',
      description: 'Faculty must be one among first 3 authors. Designation-based scoring per paper.',
      input_type: 'number',
      input_config: { max_attachments: 2, field: 'count' },
    },
    {
      sl_no: 4,
      section: ScoringSection.RESEARCH,
      name: 'Non-paid Non-refereed Journals and Non-indexed Conferences',
      description: 'Faculty must be one among first 3 authors. 10% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 2, field: 'count' },
    },
    {
      sl_no: 5,
      section: ScoringSection.RESEARCH,
      name: 'Books/Chapters',
      description: 'Faculty must be one among first 3 authors. 1 book = 50%, 1 chapter = 20%.',
      input_type: 'composite',
      input_config: { max_attachments: 1, fields: ['books', 'chapters'] },
    },
    {
      sl_no: 6,
      section: ScoringSection.RESEARCH,
      name: 'Disclosures Filed',
      description: '1 disclosure = 10% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 7,
      section: ScoringSection.RESEARCH,
      name: 'Patents Granted',
      description: '1 patent = 50% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 8,
      section: ScoringSection.RESEARCH,
      name: 'Research Guidance UG',
      description: '1 batch = 1% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 9,
      section: ScoringSection.RESEARCH,
      name: 'Research Guidance PG',
      description: '1 batch = 3% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 10,
      section: ScoringSection.RESEARCH,
      name: 'Research Guidance PhD',
      description: '1 batch = 7% of research weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 11,
      section: ScoringSection.RESEARCH,
      name: 'Funded Projects',
      description: 'Slab-based: ≥10L=100%, ≥5L=50%, ≥1L=30%, <1L=20% of research weightage.',
      input_type: 'currency_slab',
      input_config: { max_attachments: 1, field: 'amount_lakhs' },
    },
    {
      sl_no: 12,
      section: ScoringSection.RESEARCH,
      name: 'Consulting Projects',
      description: 'Slab-based: ≥10L=100%, ≥5L=60%, ≥1L=50%, <1L=20% of research weightage.',
      input_type: 'currency_slab',
      input_config: { max_attachments: 1, field: 'amount_lakhs' },
    },

    // ── SERVICE & PROFESSIONAL DEVELOPMENT ──
    {
      sl_no: 13,
      section: ScoringSection.SERVICE,
      name: 'Conference Chair, Session Chair, Reviewer of Q1/Q2 Journal',
      description: '5% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 14,
      section: ScoringSection.SERVICE,
      name: 'FDP/Seminar/Workshop organized as coordinator',
      description: '5 days = 10%, 3 days = 5% of service weightage.',
      input_type: 'days_slab',
      input_config: { max_attachments: 1, field: 'days' },
    },
    {
      sl_no: 15,
      section: ScoringSection.SERVICE,
      name: 'Invited Technical Talks outside the Institute',
      description: '10% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 16,
      section: ScoringSection.SERVICE,
      name: 'Events Participated Outside Institute (FDP/Seminar/Workshop/Conference)',
      description: '10% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 17,
      section: ScoringSection.SERVICE,
      name: 'Events Participated Inside Institute (FDP/Seminar/Workshop/Conference)',
      description: '5% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 18,
      section: ScoringSection.SERVICE,
      name: 'Industry Relations (MoU, Co-hosted event, Technical Talk Series)',
      description: '10% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 19,
      section: ScoringSection.SERVICE,
      name: 'Institutional/Departmental Services (NBA/NIRF)',
      description: 'Coordinator = 20%, Others = 5% of service weightage.',
      input_type: 'role_select',
      input_config: { max_attachments: 1, field: 'role', options: ['coordinator', 'member'] },
    },
    {
      sl_no: 20,
      section: ScoringSection.SERVICE,
      name: 'Other Services to Institution or Society Contribution',
      description: '3% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 21,
      section: ScoringSection.SERVICE,
      name: 'Awards and Honours',
      description: '1 event = 15% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 22,
      section: ScoringSection.SERVICE,
      name: 'Professionalism / Team Spirit',
      description: '2% of service weightage.',
      input_type: 'number',
      input_config: { max_attachments: 1, field: 'count' },
    },
    {
      sl_no: 23,
      section: ScoringSection.SERVICE,
      name: 'Any Other Major Contributions',
      description: 'Free text (max 500 characters), no automatic scoring.',
      input_type: 'text',
      input_config: { max_attachments: 1, field: 'description', max_chars: 500 },
    },
  ];

  // Clear old data to avoid conflicts
  console.log('🧹 Clearing old scoring data...');
  await prisma.proofDocument.deleteMany({});
  await prisma.categoryEntry.deleteMany({});
  await prisma.scoringRule.deleteMany({});
  await prisma.scoringCategory.deleteMany({});
  console.log('✅ Old scoring data cleared');

  const createdCategories: Record<number, string> = {};
  for (const cat of categories) {
    const c = await prisma.scoringCategory.create({
      data: {
        id: `cat-${cat.sl_no}`,
        sl_no: cat.sl_no,
        section: cat.section,
        name: cat.name,
        description: cat.description,
        input_type: cat.input_type,
        input_config: cat.input_config,
      },
    });
    createdCategories[cat.sl_no] = c.id;
  }
  console.log(`✅ ${categories.length} scoring categories seeded (per FINAL_SCORING.md)`);

  // ─── SCORING RULES ─────────────────────────────────────────────────────────
  // Section maxes by designation (from FINAL_SCORING.md)
  // Teaching: AP=60, AssoP=50, Prof=40
  // Research: AP=10, AssoP=20, Prof=30
  // Service:  AP=30, AssoP=30, Prof=30

  const sectionMaxes: Record<ScoringSection, Record<Designation, number>> = {
    TEACHING: { ASSISTANT_PROFESSOR: 60, ASSOCIATE_PROFESSOR: 50, PROFESSOR: 40 },
    RESEARCH: { ASSISTANT_PROFESSOR: 10, ASSOCIATE_PROFESSOR: 20, PROFESSOR: 30 },
    SERVICE:  { ASSISTANT_PROFESSOR: 30, ASSOCIATE_PROFESSOR: 30, PROFESSOR: 30 },
  };

  const designations = [Designation.ASSISTANT_PROFESSOR, Designation.ASSOCIATE_PROFESSOR, Designation.PROFESSOR];

  // For each category, the max_weightage = section max for that designation
  // The formula JSON stores the specific scoring logic from FINAL_SCORING.md

  const formulasBySlNo: Record<number, any> = {
    1:  { type: 'fci_slab', slabs: [{ min: 85, pct: 100 }, { min: 80, pct: 90 }, { min: 75, pct: 80 }, { min: 70, pct: 70 }, { min: 0, pct: 40 }] },
    2:  { type: 'count_threshold', pct_per_item: 100, description: '1 paper = 100% of research weightage' },
    3:  { type: 'designation_based', ASSISTANT_PROFESSOR: 50, ASSOCIATE_PROFESSOR: 25, PROFESSOR: 20, description: 'pct per paper varies by designation' },
    4:  { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
    5:  { type: 'composite', book_pct: 50, chapter_pct: 20, description: '1 book=50%, 1 chapter=20%' },
    6:  { type: 'count_pct', pct_per_item: 10, description: '1 disclosure = 10%' },
    7:  { type: 'count_pct', pct_per_item: 50, description: '1 patent = 50%' },
    8:  { type: 'count_pct', pct_per_item: 1, description: '1 batch = 1%' },
    9:  { type: 'count_pct', pct_per_item: 3, description: '1 batch = 3%' },
    10: { type: 'count_pct', pct_per_item: 7, description: '1 batch = 7%' },
    11: { type: 'currency_slab', slabs: [{ min: 10, pct: 100 }, { min: 5, pct: 50 }, { min: 1, pct: 30 }, { min: 0, pct: 20 }] },
    12: { type: 'currency_slab', slabs: [{ min: 10, pct: 100 }, { min: 5, pct: 60 }, { min: 1, pct: 50 }, { min: 0, pct: 20 }] },
    13: { type: 'count_threshold', pct_if_any: 5, description: '5% if count > 0' },
    14: { type: 'days_slab', slabs: [{ min: 5, pct: 10 }, { min: 3, pct: 5 }] },
    15: { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
    16: { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
    17: { type: 'count_threshold', pct_if_any: 5, description: '5% if count > 0' },
    18: { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
    19: { type: 'role_based', coordinator_pct: 20, member_pct: 5 },
    20: { type: 'count_threshold', pct_if_any: 3, description: '3% if count > 0' },
    21: { type: 'count_pct', pct_per_item: 15, description: '1 event = 15%' },
    22: { type: 'count_threshold', pct_if_any: 2, description: '2% if count > 0' },
    23: { type: 'free_text', pct: 0, description: 'No automatic scoring' },
  };

  let ruleCount = 0;
  for (const cat of categories) {
    const section = cat.section;
    for (const designation of designations) {
      const maxW = sectionMaxes[section][designation];
      await prisma.scoringRule.create({
        data: {
          category_id: createdCategories[cat.sl_no],
          designation,
          max_weightage: maxW,
          formula: formulasBySlNo[cat.sl_no],
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
