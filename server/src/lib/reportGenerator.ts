import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from './prisma.js';
import { ApplicationStatus } from '@prisma/client';
import { PassThrough } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import { PDFDocument as PDFLibDoc } from 'pdf-lib';

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

export async function generateAppraisalPDF(applicationId: string, userRole: string): Promise<Buffer> {
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
          proof_documents: true,
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
  const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const primaryColor = '#000000';
  const darkText = '#000000';
  const mutedText = '#333333';
  const lineColor = '#cccccc';

  // Helper for drawing tables
  function drawTable(startY: number, colWidths: number[], headers: string[], rows: string[][], drawBorders = true) {
    let y = startY;
    const padding = 5;

    function checkPageBreak(requiredHeight: number) {
      if (y + requiredHeight > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }
    }

    // Draw header
    checkPageBreak(30);
    let hx = 50;
    doc.font('Helvetica-Bold').fontSize(9).fill('#000000');
    
    let maxHeaderHeight = 20;
    for (let i = 0; i < headers.length; i++) {
      const th = doc.heightOfString(headers[i] || ' ', { width: colWidths[i] - 2 * padding }) + 2 * padding;
      if (th > maxHeaderHeight) maxHeaderHeight = th;
    }
    
    if (drawBorders) {
      doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), maxHeaderHeight).fillAndStroke('#f3f4f6', lineColor);
    }
    
    doc.fill(darkText);
    for (let i = 0; i < headers.length; i++) {
      if (drawBorders) {
        doc.rect(hx, y, colWidths[i], maxHeaderHeight).stroke(lineColor);
      }
      doc.text(headers[i] || '', hx + padding, y + padding, { width: colWidths[i] - 2 * padding, align: 'left' });
      hx += colWidths[i];
    }
    y += maxHeaderHeight;

    // Draw rows
    doc.font('Helvetica').fontSize(9);
    for (const row of rows) {
      let maxRowHeight = 20;
      for (let i = 0; i < row.length; i++) {
        const th = doc.heightOfString(row[i] || ' ', { width: colWidths[i] - 2 * padding }) + 2 * padding;
        if (th > maxRowHeight) maxRowHeight = th;
      }

      checkPageBreak(maxRowHeight);

      let rx = 50;
      for (let i = 0; i < row.length; i++) {
        if (drawBorders) {
          doc.rect(rx, y, colWidths[i], maxRowHeight).stroke(lineColor);
        }
        doc.text(row[i] || '', rx + padding, y + padding, { width: colWidths[i] - 2 * padding, align: 'left' });
        rx += colWidths[i];
      }
      y += maxRowHeight;
    }
    return y;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PART 1: SUMMARY FORM
  // ═════════════════════════════════════════════════════════════════════════════

  doc.fontSize(14).font('Helvetica-Bold').text('Ramaiah Institute of Technology, Bangalore - 560054', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('(Autonomous Institute, affiliated to VTU)', { align: 'center' });
  doc.moveDown(1.5);
  doc.fontSize(12).font('Helvetica-Bold').text(`Annual Appraisal Form for the Year ${app.academic_year}`, { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(11).font('Helvetica-Bold').text(`Name: `, { continued: true }).font('Helvetica').text(app.faculty.name);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text(`Designation: `, { continued: true }).font('Helvetica').text(designationLabels[app.faculty.designation || ''] || 'N/A');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text(`Department: `, { continued: true }).font('Helvetica').text(app.faculty.department?.name || 'N/A');
  doc.moveDown(2);

  const summaryColWidths = [50, 350, 95];
  const summaryHeaders = ['Sl. No.', 'Scoring Category', 'Number'];
  const summaryRows: string[][] = [];

  let currentSection = '';
  let dynamicTotal = 0;
  for (const entry of app.category_entries) {
    if (entry.category.section !== currentSection) {
      currentSection = entry.category.section;
      summaryRows.push(['', sectionLabels[currentSection] || currentSection, '']);
    }
    const scoreVal = entry.reviewer_score !== null ? Number(entry.reviewer_score) : Number(entry.calculated_score);
    dynamicTotal += scoreVal;
    summaryRows.push([String(entry.category.sl_no), entry.category.name, scoreVal.toFixed(1)]);
  }

  let yPos = drawTable(doc.y, summaryColWidths, summaryHeaders, summaryRows, true);

  yPos += 20;
  if (yPos > doc.page.height - 150) { doc.addPage(); yPos = 50; }
  
  doc.rect(50, yPos, 495, 20).stroke(lineColor);
  doc.font('Helvetica-Bold').fontSize(10).text('Total', 55, yPos + 5, { width: 395, align: 'right' });
  doc.text(dynamicTotal.toFixed(1), 455, yPos + 5);
  
  yPos += 60;
  if (yPos > doc.page.height - 100) { doc.addPage(); yPos = 50; }
  
  doc.font('Helvetica-Bold').text('Signature of the Faculty', 50, yPos);
  
  function drawSignatureBlock(title: string, review: any, startY: number) {
    if (startY > doc.page.height - 120) { doc.addPage(); startY = 50; }
    doc.font('Helvetica-Bold').fontSize(10).text(title, 50, startY);
    doc.font('Helvetica').fontSize(9).text(review?.comments || '_______________________________________', 50, startY + 15, { width: 450 });
    
    if (review) {
      doc.font('Helvetica-Bold').text(`Decision: ${review.decision.replace(/_/g, ' ')}`, 50, startY + 35);
      doc.text(`Date: ${formatDate(review.reviewed_at)}`, 50, startY + 50);
      
      const sigHash = `VERIFIED-${review.id.split('-')[0].toUpperCase()}`;
      if (review.signature_path && fsSync.existsSync(review.signature_path)) {
        doc.text('Signature:', 350, startY + 35);
        try {
          doc.image(review.signature_path, 350, startY + 50, { fit: [100, 30] });
        } catch (e) {
          doc.fill('#10b981').text(`[ VERIFIED ]\nID: ${sigHash}`, 350, startY + 50);
          doc.fill('#000000');
        }
      } else {
        const isPositive = ['RECOMMENDED', 'APPROVED'].includes(review.decision);
        const color = isPositive ? '#10b981' : '#ef4444';
        const icon = isPositive ? '[ APPROVED / VERIFIED ]' : '[ REVERTED ]';
        doc.fill(color).text(`${icon}\nID: ${sigHash}`, 350, startY + 40);
        doc.fill('#000000');
      }
    } else {
      doc.font('Helvetica-Bold').text('Decision: _____________________', 50, startY + 35);
      doc.text('Date: _____________________', 50, startY + 50);
      doc.text('Signature', 350, startY + 50);
    }
    return startY + 80;
  }

  const hodReviews = app.reviews.filter(r => r.reviewer.role === 'HOD');
  const reviewerReviews = app.reviews.filter(r => r.reviewer.role === 'REVIEWER');
  const principalReviews = app.reviews.filter(r => r.reviewer.role === 'PRINCIPAL');

  const orderedReviews: { title: string, review: any }[] = [];
  
  // HOD
  if (hodReviews.length > 0) {
    hodReviews.forEach(r => orderedReviews.push({ title: 'Comments from HoD:', review: r }));
  } else {
    orderedReviews.push({ title: 'Comments from HoD:', review: null });
  }

  // REVIEWER
  if (reviewerReviews.length > 0) {
    reviewerReviews.forEach(r => orderedReviews.push({ title: 'Comments from Reviewer:', review: r }));
  } else {
    orderedReviews.push({ title: 'Comments from Reviewer:', review: null });
  }

  // PRINCIPAL
  if (principalReviews.length > 0) {
    principalReviews.forEach(r => orderedReviews.push({ title: 'Comments from Principal:', review: r }));
  } else {
    orderedReviews.push({ title: 'Comments from Principal:', review: null });
  }

  yPos += 30;
  for (const item of orderedReviews) {
    yPos = drawSignatureBlock(item.title, item.review, yPos);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PART 2: DETAILED INFORMATION (Annexure)
  // ═════════════════════════════════════════════════════════════════════════════

  doc.addPage();

  doc.fontSize(14).font('Helvetica-Bold').text('RAMAIAH INSTITUTE OF TECHNOLOGY', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').text('Detailed information for Annual Increment for Teaching Staff', { align: 'center' });
  doc.moveDown(2);

  const detailColWidths = [40, 150, 255, 50];
  const detailHeaders = ['Sl.No', 'Scoring Category', 'Detailed Information', 'Appendix provided (Y/N)'];
  const detailRows: string[][] = [];

  for (const entry of app.category_entries) {
    const rawVal = entry.raw_value as any || {};
    const count = (rawVal.count || 0) + (rawVal.books || 0) + (rawVal.chapters || 0);
    const hasGlobalDocs = entry.proof_documents.some((d: any) => d.item_index == null);

    let detailsText = '';
    
    if (rawVal.description) {
      detailsText += `${rawVal.description}\n`;
    }

    for (let i = 0; i < count; i++) {
      const itemDesc = rawVal[`item_desc_${i}`] || 'Item details missing';
      detailsText += `${i + 1}. ${itemDesc}\n\n`;
    }

    if (!detailsText) {
      detailsText = '-\n';
    }

    const hasProof = (count > 0 && entry.proof_documents.length > 0) || hasGlobalDocs;
    const appendixText = hasProof ? 'Y' : 'N';

    detailRows.push([
      String(entry.category.sl_no),
      entry.category.name,
      detailsText.trim(),
      appendixText
    ]);
  }

  drawTable(doc.y, detailColWidths, detailHeaders, detailRows, true);

  doc.end();
  const basePdfBuffer = await pdfBufferPromise;

  const mergedPdf = await PDFLibDoc.load(basePdfBuffer);

  for (const entry of app.category_entries) {
    for (const docInfo of entry.proof_documents) {
      if (docInfo.file_path && docInfo.file_name.toLowerCase().endsWith('.pdf')) {
        try {
          const docPath = path.join(process.cwd(), docInfo.file_path);
          const attachedPdfBytes = await fs.readFile(docPath);
          const attachedPdf = await PDFLibDoc.load(attachedPdfBytes);
          const copiedPages = await mergedPdf.copyPages(attachedPdf, attachedPdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
        } catch (e) {
          console.error(`Failed to merge attached document ${docInfo.file_name}`, e);
        }
      }
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  return Buffer.from(mergedPdfBytes);
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
      category_entries: {
        include: { category: { select: { section: true } } },
      },
    },
    orderBy: [{ faculty: { department: { name: 'asc' } } }, { final_score: 'desc' }],
  });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
  const stream = new PassThrough();
  doc.pipe(stream);

  const primaryColor = '#000000';
  const darkText = '#000000';
  const mutedText = '#333333';
  const lineColor = '#cccccc';

  // ── Title ──
  doc.rect(0, 0, doc.page.width, 80).fill('#ffffff');
  doc.fill('#000000').fontSize(20).font('Helvetica-Bold')
    .text('CONSOLIDATED FACULTY APPRAISAL REPORT', 40, 20, { align: 'center' });
  doc.fontSize(10).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleDateString('en-IN')} | ${applications.length} Applications`, 40, 48, { align: 'center' });

  try {
    const logoPath = path.join(__dirname, '../../assets/logo.png');
    doc.image(logoPath, doc.page.width - 120, 10, { width: 60 });
  } catch (err) {
    console.error('Logo not found', err);
  }

  let y = 100;

  // ── Summary Stats ──
  const departments = [...new Set(applications.map(a => a.faculty.department?.name || 'N/A'))];
  const avgScore = applications.length > 0
    ? (applications.reduce((s, a) => s + Number(a.final_score), 0) / applications.length).toFixed(1)
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

    let teachingScore = 0;
    let researchScore = 0;
    let serviceScore = 0;

    app.category_entries.forEach(entry => {
      const scoreVal = entry.reviewer_score !== null ? Number(entry.reviewer_score) : Number(entry.calculated_score);
      const section = entry.category.section;
      if (section === 'TEACHING') teachingScore += scoreVal;
      else if (section === 'RESEARCH') researchScore += scoreVal;
      else if (section === 'SERVICE') serviceScore += scoreVal;
    });

    const finalTotal = teachingScore + researchScore + serviceScore;

    doc.fill(darkText).fontSize(8).font('Helvetica');
    let rx = 45;
    const row = [
      String(idx + 1),
      app.faculty.name,
      app.faculty.department?.code || 'N/A',
      designationLabels[app.faculty.designation || ''] || 'N/A',
      teachingScore.toFixed(1),
      researchScore.toFixed(1),
      serviceScore.toFixed(1),
      finalTotal.toFixed(1),
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
    orderBy: [{ faculty: { department: { name: 'asc' } } }, { final_score: 'desc' }],
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
    const dept = app.faculty.department?.name || 'N/A';
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(Number(app.final_score));
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
  const allScores = applications.map(a => Number(a.final_score));
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
      dept: app.faculty.department?.name || 'N/A',
      designation: designationLabels[app.faculty.designation || ''] || 'N/A',
      year: app.academic_year,
      status: statusLabels[app.status] || app.status,
      score: Number(app.final_score),
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
      dept: app.faculty.department?.code || 'N/A',
      total: Number(app.final_score),
    };
    app.category_entries.forEach(entry => {
      row[`cat_${entry.category.sl_no}`] = entry.reviewer_score !== null ? Number(entry.reviewer_score) : Number(entry.calculated_score);
    });
    catSheet.addRow(row);
  });

  return wb;
}
