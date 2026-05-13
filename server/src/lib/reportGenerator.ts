import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from './prisma.js';
import { ApplicationStatus } from '@prisma/client';
import { PassThrough } from 'stream';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const sectionLabels: Record<string, string> = {
  TEACHING: 'Teaching & Learning',
  RESEARCH: 'Research & Publications',
  SERVICE: 'Service & Professional Development',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  HOD_REVIEWED: 'HOD Reviewed',
  REVIEWER_ASSIGNED: 'Reviewer Assigned',
  REVIEWER_REVIEWED: 'Reviewer Reviewed',
  PRINCIPAL_REVIEWED: 'Principal Reviewed',
  FROZEN: 'Frozen',
  SENT_TO_ACCOUNTS: 'Sent to Accounts',
};

const designationLabels: Record<string, string> = {
  ASSISTANT_PROFESSOR: 'Assistant Professor',
  ASSOCIATE_PROFESSOR: 'Associate Professor',
  PROFESSOR: 'Professor',
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Individual Appraisal PDF ──────────────────────────────────────────────────

export async function generateAppraisalPDF(applicationId: string): Promise<PassThrough> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      faculty: {
        select: {
          name: true, email: true, designation: true,
          department: { select: { name: true, code: true } },
        },
      },
      category_entries: {
        include: {
          category: { select: { sl_no: true, section: true, name: true } },
        },
        orderBy: { category: { sl_no: 'asc' } },
      },
      reviews: {
        include: { reviewer: { select: { name: true, role: true } } },
        orderBy: { reviewed_at: 'asc' },
      },
    },
  });

  if (!app) throw new Error('Application not found');

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const stream = new PassThrough();
  doc.pipe(stream);

  const primaryColor = '#4f46e5';
  const darkText = '#1e293b';
  const mutedText = '#64748b';
  const lineColor = '#e2e8f0';

  // ── Header ──
  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.fill('#ffffff')
    .fontSize(22).font('Helvetica-Bold')
    .text('FACULTY APPRAISAL FORM', 50, 25, { align: 'center' });
  doc.fontSize(11).font('Helvetica')
    .text('Rashtreeya Vidyalaya Institute of Technology', 50, 52, { align: 'center' });
  doc.fontSize(10)
    .text(`Academic Year: ${app.academic_year}`, 50, 70, { align: 'center' });

  doc.moveDown(2);
  let y = 120;

  // ── Faculty Information Box ──
  doc.rect(50, y, doc.page.width - 100, 80).lineWidth(0.5).stroke(lineColor);
  doc.fill(primaryColor).fontSize(11).font('Helvetica-Bold')
    .text('FACULTY INFORMATION', 60, y + 8);

  y += 28;
  doc.fill(darkText).fontSize(9).font('Helvetica');
  const infoCol1 = 60;
  const infoCol2 = 300;
  doc.font('Helvetica-Bold').text('Name:', infoCol1, y).font('Helvetica').text(app.faculty.name, infoCol1 + 80, y);
  doc.font('Helvetica-Bold').text('Department:', infoCol2, y).font('Helvetica').text(app.faculty.department.name, infoCol2 + 80, y);
  y += 18;
  doc.font('Helvetica-Bold').text('Designation:', infoCol1, y).font('Helvetica')
    .text(designationLabels[app.faculty.designation || ''] || 'N/A', infoCol1 + 80, y);
  doc.font('Helvetica-Bold').text('Status:', infoCol2, y).font('Helvetica')
    .text(statusLabels[app.status] || app.status, infoCol2 + 80, y);

  y += 35;

  // ── Score Summary ──
  const teaching = app.category_entries
    .filter(e => e.category.section === 'TEACHING')
    .reduce((sum, e) => sum + Number(e.calculated_score), 0);
  const research = app.category_entries
    .filter(e => e.category.section === 'RESEARCH')
    .reduce((sum, e) => sum + Number(e.calculated_score), 0);
  const service = app.category_entries
    .filter(e => e.category.section === 'SERVICE')
    .reduce((sum, e) => sum + Number(e.calculated_score), 0);
  const total = Number(app.total_score);

  doc.rect(50, y, doc.page.width - 100, 55).lineWidth(0.5).stroke(lineColor);
  doc.fill(primaryColor).fontSize(11).font('Helvetica-Bold')
    .text('SCORE SUMMARY', 60, y + 8);

  y += 28;
  const scoreBoxWidth = (doc.page.width - 140) / 4;
  const scores = [
    { label: 'Teaching', value: teaching.toFixed(1) },
    { label: 'Research', value: research.toFixed(1) },
    { label: 'Service', value: service.toFixed(1) },
    { label: 'TOTAL', value: total.toFixed(1) },
  ];
  scores.forEach((s, i) => {
    const sx = 60 + i * scoreBoxWidth;
    doc.fill(mutedText).fontSize(8).font('Helvetica').text(s.label, sx, y);
    doc.fill(i === 3 ? primaryColor : darkText).fontSize(14).font('Helvetica-Bold').text(s.value, sx, y + 10);
  });

  y += 45;

  // ── Category Scores Table ──
  doc.fill(primaryColor).fontSize(11).font('Helvetica-Bold').text('CATEGORY-WISE SCORES', 50, y);
  y += 20;

  // Table header
  const colWidths = [30, 200, 100, 80, 80];
  const headers = ['Sl', 'Category', 'Section', 'Score', 'Max'];
  doc.rect(50, y, doc.page.width - 100, 18).fill('#f1f5f9');
  let hx = 55;
  doc.fill(darkText).fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, hx, y + 5, { width: colWidths[i] });
    hx += colWidths[i];
  });
  y += 20;

  // Table rows
  let currentSection = '';
  for (const entry of app.category_entries) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }

    if (entry.category.section !== currentSection) {
      currentSection = entry.category.section;
      doc.rect(50, y, doc.page.width - 100, 16).fill('#eef2ff');
      doc.fill(primaryColor).fontSize(8).font('Helvetica-Bold')
        .text(sectionLabels[currentSection] || currentSection, 55, y + 4);
      y += 18;
    }

    doc.fill(darkText).fontSize(8).font('Helvetica');
    let rx = 55;
    const rowData = [
      String(entry.category.sl_no),
      entry.category.name,
      entry.category.section,
      Number(entry.calculated_score).toFixed(1),
      '—',
    ];
    rowData.forEach((val, i) => {
      doc.text(val, rx, y, { width: colWidths[i] });
      rx += colWidths[i];
    });

    y += 16;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).lineWidth(0.3).stroke(lineColor);
    y += 2;
  }

  y += 15;

  // ── Review History ──
  if (app.reviews.length > 0) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 50;
    }

    doc.fill(primaryColor).fontSize(11).font('Helvetica-Bold').text('REVIEW HISTORY', 50, y);
    y += 20;

    for (const review of app.reviews) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 50;
      }

      doc.fill(darkText).fontSize(9).font('Helvetica-Bold')
        .text(`${review.reviewer.name} (${review.reviewer.role})`, 55, y);
      doc.fill(mutedText).fontSize(8).font('Helvetica')
        .text(`${review.decision} — ${formatDate(review.reviewed_at)}`, 350, y);
      y += 14;
      if (review.comments) {
        doc.fill(darkText).fontSize(8).font('Helvetica')
          .text(`Comments: ${review.comments}`, 55, y, { width: doc.page.width - 110 });
        y += doc.heightOfString(`Comments: ${review.comments}`, { width: doc.page.width - 110 }) + 4;
      }
      y += 8;
    }
  }

  // ── Footer ──
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fill(mutedText).fontSize(7).font('Helvetica')
      .text(
        `Generated: ${new Date().toLocaleString('en-IN')} | Page ${i + 1} of ${totalPages}`,
        50,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - 100 }
      );
  }

  doc.end();
  return stream;
}

// ─── Consolidated Report PDF ───────────────────────────────────────────────────

export async function generateConsolidatedPDF(
  filters: { academic_year?: string; department_id?: string }
): Promise<PassThrough> {
  const where: any = {
    status: { in: [ApplicationStatus.FROZEN, ApplicationStatus.SENT_TO_ACCOUNTS, ApplicationStatus.PRINCIPAL_REVIEWED] },
  };
  if (filters.academic_year) where.academic_year = filters.academic_year;
  if (filters.department_id) where.faculty = { department_id: filters.department_id };

  const applications = await prisma.application.findMany({
    where,
    include: {
      faculty: {
        select: {
          name: true, designation: true,
          department: { select: { name: true, code: true } },
        },
      },
    },
    orderBy: [{ faculty: { department: { name: 'asc' } } }, { total_score: 'desc' }],
  });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
  const stream = new PassThrough();
  doc.pipe(stream);

  const primaryColor = '#4f46e5';
  const darkText = '#1e293b';
  const mutedText = '#64748b';
  const lineColor = '#e2e8f0';

  // ── Title ──
  doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
  doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold')
    .text('CONSOLIDATED FACULTY APPRAISAL REPORT', 40, 20, { align: 'center' });
  doc.fontSize(10).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleDateString('en-IN')} | ${applications.length} Applications`, 40, 48, { align: 'center' });

  let y = 100;

  // ── Summary Stats ──
  const departments = [...new Set(applications.map(a => a.faculty.department.name))];
  const avgScore = applications.length > 0
    ? (applications.reduce((s, a) => s + Number(a.total_score), 0) / applications.length).toFixed(1)
    : '0';

  doc.fill(darkText).fontSize(12).font('Helvetica-Bold').text('Summary', 40, y);
  y += 18;
  doc.fontSize(9).font('Helvetica').fill(mutedText);
  doc.text(`Total Applications: ${applications.length}    |    Departments: ${departments.length}    |    Average Score: ${avgScore}    |    Year: ${filters.academic_year || 'All'}`, 40, y);
  y += 25;

  // ── Table ──
  const colW = [30, 180, 120, 130, 70, 70, 70, 70];
  const hdrs = ['#', 'Faculty Name', 'Department', 'Designation', 'Teaching', 'Research', 'Service', 'Total'];

  doc.rect(40, y, doc.page.width - 80, 18).fill('#f1f5f9');
  let hx = 45;
  doc.fill(darkText).fontSize(8).font('Helvetica-Bold');
  hdrs.forEach((h, i) => {
    doc.text(h, hx, y + 5, { width: colW[i] });
    hx += colW[i];
  });
  y += 20;

  applications.forEach((app, idx) => {
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    if (idx % 2 === 0) {
      doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fafafa');
    }

    doc.fill(darkText).fontSize(8).font('Helvetica');
    let rx = 45;
    const row = [
      String(idx + 1),
      app.faculty.name,
      app.faculty.department.code,
      designationLabels[app.faculty.designation || ''] || 'N/A',
      '—', '—', '—',
      Number(app.total_score).toFixed(1),
    ];
    row.forEach((val, i) => {
      doc.text(val, rx, y, { width: colW[i] });
      rx += colW[i];
    });
    y += 16;
  });

  // ── Footer on all pages ──
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fill(mutedText).fontSize(7).font('Helvetica')
      .text(
        `RIT Faculty Appraisal System — Consolidated Report | Page ${i + 1} of ${totalPages}`,
        40, doc.page.height - 25,
        { align: 'center', width: doc.page.width - 80 }
      );
  }

  doc.end();
  return stream;
}

// ─── Excel Report ──────────────────────────────────────────────────────────────

export async function generateExcelReport(
  filters: { academic_year?: string; department_id?: string }
): Promise<ExcelJS.Workbook> {
  const where: any = {
    status: { not: ApplicationStatus.DRAFT },
  };
  if (filters.academic_year) where.academic_year = filters.academic_year;
  if (filters.department_id) where.faculty = { department_id: filters.department_id };

  const applications = await prisma.application.findMany({
    where,
    include: {
      faculty: {
        select: {
          name: true, email: true, designation: true,
          department: { select: { name: true, code: true } },
        },
      },
      category_entries: {
        include: { category: { select: { sl_no: true, name: true, section: true } } },
        orderBy: { category: { sl_no: 'asc' } },
      },
    },
    orderBy: [{ faculty: { department: { name: 'asc' } } }, { total_score: 'desc' }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'RIT Appraisal System';
  wb.created = new Date();

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };

  // ── Sheet 1: Summary ──
  const summarySheet = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF4F46E5' } } });
  summarySheet.columns = [
    { header: 'Department', key: 'dept', width: 35 },
    { header: 'Applications', key: 'count', width: 15 },
    { header: 'Average Score', key: 'avg', width: 15 },
    { header: 'Highest Score', key: 'max', width: 15 },
    { header: 'Lowest Score', key: 'min', width: 15 },
  ];

  summarySheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
  });

  const deptMap = new Map<string, number[]>();
  applications.forEach(app => {
    const dept = app.faculty.department.name;
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(Number(app.total_score));
  });

  deptMap.forEach((scores, dept) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    summarySheet.addRow({
      dept,
      count: scores.length,
      avg: parseFloat(avg.toFixed(1)),
      max: parseFloat(Math.max(...scores).toFixed(1)),
      min: parseFloat(Math.min(...scores).toFixed(1)),
    });
  });

  // Total row
  const allScores = applications.map(a => Number(a.total_score));
  if (allScores.length > 0) {
    const totalRow = summarySheet.addRow({
      dept: 'TOTAL',
      count: allScores.length,
      avg: parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)),
      max: parseFloat(Math.max(...allScores).toFixed(1)),
      min: parseFloat(Math.min(...allScores).toFixed(1)),
    });
    totalRow.font = { bold: true };
  }

  // ── Sheet 2: Faculty Detail ──
  const detailSheet = wb.addWorksheet('Faculty Details', { properties: { tabColor: { argb: 'FF10B981' } } });
  detailSheet.columns = [
    { header: '#', key: 'sl', width: 5 },
    { header: 'Faculty Name', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Department', key: 'dept', width: 22 },
    { header: 'Designation', key: 'designation', width: 22 },
    { header: 'Academic Year', key: 'year', width: 14 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Total Score', key: 'score', width: 12 },
    { header: 'Submitted', key: 'submitted', width: 14 },
  ];

  detailSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
  });

  applications.forEach((app, i) => {
    detailSheet.addRow({
      sl: i + 1,
      name: app.faculty.name,
      email: app.faculty.email,
      dept: app.faculty.department.name,
      designation: designationLabels[app.faculty.designation || ''] || 'N/A',
      year: app.academic_year,
      status: statusLabels[app.status] || app.status,
      score: Number(app.total_score),
      submitted: formatDate(app.submitted_at),
    });
  });

  // ── Sheet 3: Category Breakdown ──
  const catSheet = wb.addWorksheet('Category Scores', { properties: { tabColor: { argb: 'FFF59E0B' } } });

  // Get all categories
  const categories = await prisma.scoringCategory.findMany({ orderBy: { sl_no: 'asc' } });

  catSheet.columns = [
    { header: '#', key: 'sl', width: 5 },
    { header: 'Faculty Name', key: 'name', width: 25 },
    { header: 'Department', key: 'dept', width: 15 },
    ...categories.map(c => ({ header: `${c.sl_no}. ${c.name}`, key: `cat_${c.sl_no}`, width: 14 })),
    { header: 'Total', key: 'total', width: 10 },
  ];

  catSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = { ...headerFont, size: 8 };
    cell.border = borderThin;
    cell.alignment = { wrapText: true };
  });

  applications.forEach((app, i) => {
    const row: Record<string, any> = {
      sl: i + 1,
      name: app.faculty.name,
      dept: app.faculty.department.code,
      total: Number(app.total_score),
    };
    app.category_entries.forEach(entry => {
      row[`cat_${entry.category.sl_no}`] = Number(entry.calculated_score);
    });
    catSheet.addRow(row);
  });

  return wb;
}
