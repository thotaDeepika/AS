import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from './prisma.js';
import { ApplicationStatus, Role } from '@prisma/client';
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
  CHAIRMAN_ASSIGNED: 'Chairman Assigned',
  CHAIRMAN_REVIEWED: 'Chairman Reviewed',
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

  // Helper for drawing tables with no overlapping and automatic pagination
  function drawTable(startY: number, colWidths: number[], headers: string[], rows: string[][], drawBorders = true) {
    let y = startY;
    const padding = 6;
    const totalW = colWidths.reduce((a, b) => a + b, 0);

    function checkPageBreak(requiredHeight: number) {
      if (y > 60 && y + requiredHeight > doc.page.height - 50) {
        doc.addPage();
        y = 50;
        drawHeader();
      }
    }

    function drawHeader() {
      let maxHeaderHeight = 22;
      doc.font('Helvetica-Bold').fontSize(8.5);
      for (let i = 0; i < headers.length; i++) {
        const th = doc.heightOfString(headers[i] || ' ', { width: colWidths[i] - 2 * padding, lineGap: 1 }) + 2 * padding;
        if (th > maxHeaderHeight) maxHeaderHeight = th;
      }
      if (drawBorders) {
        doc.rect(50, y, totalW, maxHeaderHeight).fillAndStroke('#f1f5f9', lineColor);
      }
      doc.fill('#0f172a');
      let hx = 50;
      for (let i = 0; i < headers.length; i++) {
        if (drawBorders) {
          doc.rect(hx, y, colWidths[i], maxHeaderHeight).stroke(lineColor);
        }
        const isRightAlign = headers[i].toLowerCase().includes('score') || headers[i].toLowerCase().includes('number');
        doc.text(headers[i] || '', hx + padding, y + padding, {
          width: colWidths[i] - 2 * padding,
          align: isRightAlign ? 'right' : 'left',
          lineGap: 1
        });
        hx += colWidths[i];
      }
      y += maxHeaderHeight;
    }

    // Initial table header
    if (y + 35 > doc.page.height - 50) {
      doc.addPage();
      y = 50;
    }
    drawHeader();

    // Draw rows
    doc.font('Helvetica').fontSize(8.5);
    for (const row of rows) {
      const isSectionHeader = row[0] === '' && (row.length < 3 || row[2] === '');
      if (isSectionHeader) {
        checkPageBreak(22);
        doc.rect(50, y, totalW, 20).fillAndStroke('#e2e8f0', lineColor);
        doc.fill('#1e293b').font('Helvetica-Bold').fontSize(9).text(row[1], 56, y + 5, { width: totalW - 12 });
        y += 20;
        continue;
      }

      doc.font('Helvetica').fontSize(8.5);
      let maxRowHeight = 20;
      for (let i = 0; i < row.length; i++) {
        const th = doc.heightOfString(row[i] || ' ', { width: colWidths[i] - 2 * padding, lineGap: 1 }) + 2 * padding;
        if (th > maxRowHeight) maxRowHeight = th;
      }

      checkPageBreak(maxRowHeight);

      let rx = 50;
      for (let i = 0; i < row.length; i++) {
        if (drawBorders) {
          doc.rect(rx, y, colWidths[i], maxRowHeight).stroke(lineColor);
        }
        const isRightAlign = headers[i]?.toLowerCase().includes('score') || headers[i]?.toLowerCase().includes('number');
        doc.fill('#000000').text(row[i] || '', rx + padding, y + padding, {
          width: colWidths[i] - 2 * padding,
          align: isRightAlign ? 'right' : 'left',
          lineGap: 1
        });
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
  doc.moveDown(1.2);
  doc.fontSize(12).font('Helvetica-Bold').text(`Annual Appraisal Form for the Year ${app.academic_year}`, { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(10.5).font('Helvetica-Bold').text(`Name: `, { continued: true }).font('Helvetica').text(app.faculty.name);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').text(`Designation: `, { continued: true }).font('Helvetica').text(designationLabels[app.faculty.designation || ''] || 'N/A');
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').text(`Department: `, { continued: true }).font('Helvetica').text(app.faculty.department?.name || 'N/A');
  doc.moveDown(1.5);

  // Two dedicated score columns: Original Score and Reviewer Score
  const summaryColWidths = [45, 270, 90, 90]; // Sum = 495 (matches page margins 50 to 545)
  const summaryHeaders = ['Sl. No.', 'Scoring Category', 'Original Score', 'Reviewer Score'];
  const summaryRows: string[][] = [];

  let currentSection = '';
  let dynamicOrigTotal = 0;
  let dynamicRevTotal = 0;
  for (const entry of app.category_entries) {
    if (entry.category.section !== currentSection) {
      currentSection = entry.category.section;
      summaryRows.push(['', sectionLabels[currentSection] || currentSection, '', '']);
    }
    const origVal = Number(entry.calculated_score);
    const revVal = entry.reviewer_score !== null ? Number(entry.reviewer_score) : origVal;
    dynamicOrigTotal += origVal;
    dynamicRevTotal += revVal;
    summaryRows.push([String(entry.category.sl_no), entry.category.name, origVal.toFixed(1), revVal.toFixed(1)]);
  }

  let yPos = drawTable(doc.y, summaryColWidths, summaryHeaders, summaryRows, true);

  yPos += 14;
  if (yPos > doc.page.height - 180) { doc.addPage(); yPos = 50; }
  
  const displayRevTotal = app.reviewer_score !== null ? Number(app.reviewer_score) : dynamicRevTotal;
  const displayFinalTotal = app.final_score !== null && Number(app.final_score) > 0 ? Number(app.final_score) : displayRevTotal;

  // Draw Two-Column Total Summary Block
  doc.rect(50, yPos, 495, 22).stroke(lineColor);
  doc.rect(50, yPos, 315, 22).fillAndStroke('#f8fafc', lineColor);
  doc.fill(darkText).font('Helvetica-Bold').fontSize(9.5).text('Total Score', 55, yPos + 6, { width: 305, align: 'right' });
  doc.rect(365, yPos, 90, 22).stroke(lineColor);
  doc.fill('#2563eb').font('Helvetica-Bold').fontSize(9.5).text(dynamicOrigTotal.toFixed(1), 365, yPos + 6, { width: 84, align: 'right' });
  doc.rect(455, yPos, 90, 22).stroke(lineColor);
  doc.fill('#d97706').font('Helvetica-Bold').fontSize(9.5).text(displayRevTotal.toFixed(1), 455, yPos + 6, { width: 84, align: 'right' });
  yPos += 24;

  // Finalized Score highlight badge if review is complete
  if (app.final_score !== null && Number(app.final_score) > 0) {
    yPos += 6;
    doc.rect(50, yPos, 495, 24).fillAndStroke('#ecfdf5', '#10b981');
    doc.fill('#065f46').font('Helvetica-Bold').fontSize(9.5)
      .text(`Official Finalized Score: ${displayFinalTotal.toFixed(1)}`, 60, yPos + 7, { width: 475, align: 'center' });
    yPos += 26;
  }
  
  yPos += 24;
  if (yPos > doc.page.height - 120) { doc.addPage(); yPos = 50; }
  
  doc.fill('#000000').font('Helvetica-Bold').fontSize(10).text(`Name of the Faculty: ${app.faculty.name}`, 50, yPos);
  yPos += 20;

  // Signature Block with Dynamic Height Calculation (No Overlapping)
  function drawSignatureBlock(title: string, review: any, startY: number) {
    const commentsText = review?.comments?.trim() ? review.comments.trim() : 'No comments provided.';
    const commentsHeight = Math.max(16, doc.font('Helvetica').fontSize(9).heightOfString(commentsText, { width: 475, lineGap: 2 }));
    const blockHeight = 22 + commentsHeight + 28;

    if (startY + blockHeight > doc.page.height - 50) {
      doc.addPage();
      startY = 50;
    }

    doc.rect(50, startY, 495, blockHeight).stroke(lineColor);
    
    // Header bar
    doc.rect(50, startY, 495, 20).fillAndStroke('#f8fafc', lineColor);
    doc.fill('#0f172a').font('Helvetica-Bold').fontSize(9.5).text(title, 56, startY + 5);

    // Comments text
    let curY = startY + 24;
    doc.fill('#334155').font('Helvetica').fontSize(9).text(commentsText, 56, curY, { width: 475, lineGap: 2 });
    curY += commentsHeight + 8;

    // Footer with Decision, Date, Evaluator name
    doc.rect(50, curY - 2, 495, 22).fillAndStroke('#fafafa', lineColor);
    if (review) {
      const isPositive = ['RECOMMENDED', 'APPROVED'].includes(review.decision);
      const decColor = isPositive ? '#059669' : '#dc2626';
      
      doc.fill('#000000').font('Helvetica-Bold').fontSize(8.5).text('Decision: ', 56, curY + 4, { continued: true });
      doc.fill(decColor).text(review.decision.replace(/_/g, ' '), { continued: true });
      doc.fill('#64748b').font('Helvetica').text(`    |    Date: ${formatDate(review.reviewed_at)}`, { continued: false });

      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(8.5).text(`Evaluator: ${review.reviewer.name}`, 310, curY + 4, { width: 230, align: 'right' });
    } else {
      doc.fill('#64748b').font('Helvetica').fontSize(8.5).text('Status: Pending Evaluation', 56, curY + 4);
    }

    return startY + blockHeight + 14;
  }

  if (userRole !== 'FACULTY') {
    const hodReviews = app.reviews.filter(r => r.reviewer.role === 'HOD');
    const reviewerReviews = app.reviews.filter(r => r.reviewer.role === 'REVIEWER');
    const chairmanReviews = app.reviews.filter(r => r.reviewer.role === 'CHAIRMAN_REVIEWER');
    const principalReviews = app.reviews.filter(r => r.reviewer.role === 'PRINCIPAL');

    const orderedReviews: { title: string, review: any }[] = [];
    
    // HOD
    if (hodReviews.length > 0) {
      hodReviews.forEach(r => orderedReviews.push({ title: 'Comments from Head of Department (HoD):', review: r }));
    } else {
      orderedReviews.push({ title: 'Comments from Head of Department (HoD):', review: null });
    }

    // PEER REVIEWER
    if (reviewerReviews.length > 0) {
      reviewerReviews.forEach(r => orderedReviews.push({ title: 'Comments from Peer Reviewer:', review: r }));
    } else {
      orderedReviews.push({ title: 'Comments from Peer Reviewer:', review: null });
    }

    // CHAIRMAN REVIEWER
    if (chairmanReviews.length > 0) {
      chairmanReviews.forEach(r => orderedReviews.push({ title: 'Comments from Chairman Reviewer (Apex Committee):', review: r }));
    } else if (app.status !== 'DRAFT' && app.status !== 'SUBMITTED' && app.status !== 'HOD_REVIEWED' && app.status !== 'REVIEWER_ASSIGNED') {
      orderedReviews.push({ title: 'Comments from Chairman Reviewer (Apex Committee):', review: null });
    }

    // PRINCIPAL
    if (principalReviews.length > 0) {
      principalReviews.forEach(r => orderedReviews.push({ title: 'Comments from Principal:', review: r }));
    } else {
      orderedReviews.push({ title: 'Comments from Principal:', review: null });
    }

    yPos += 10;
    for (const item of orderedReviews) {
      yPos = drawSignatureBlock(item.title, item.review, yPos);
    }
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
    const isGuidance = entry.category.sl_no >= 8 && entry.category.sl_no <= 10;
    
    let count = (rawVal.count || 0) + (rawVal.books || 0) + (rawVal.chapters || 0);
    // Backward compatibility: old guidance entries didn't have structured items
    if (isGuidance && !rawVal.items) {
      count = 0;
    }
    const hasGlobalDocs = entry.proof_documents.some((d: any) => d.item_index == null);

    let detailsText = '';
    
    if (isGuidance && rawVal.count !== undefined && rawVal.count !== null) {
      detailsText += `Number of Batches/Students: ${rawVal.count}\n`;
    }

    if (rawVal.description) {
      detailsText += `${rawVal.description}\n`;
    }

    // Attempt to find structured items
    let structuredItems: any[] = [];
    if (Array.isArray(rawVal.publications)) structuredItems = rawVal.publications;
    else if (Array.isArray(rawVal.items)) structuredItems = rawVal.items;
    else if (Array.isArray(rawVal.records)) structuredItems = rawVal.records;
    else if (Array.isArray(rawVal.fci_entries)) structuredItems = rawVal.fci_entries;

    const actualCount = structuredItems.length > 0 ? structuredItems.length : count;

    if (structuredItems.length > 0) {
      structuredItems.forEach((item, index) => {
        if (rawVal[`item_desc_${index}`]) {
          detailsText += `${index + 1}. ${rawVal[`item_desc_${index}`]}\n\n`;
        } else {
          // Generate dynamically
          const keysToIgnore = ['status', 'proof_documents', 'id']; 
          const parts = Object.entries(item)
            .filter(([k, v]) => !keysToIgnore.includes(k) && v !== '' && v != null)
            .map(([k, v]) => {
                const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return `${label}: ${v}`;
            });
          detailsText += `${index + 1}. ${parts.join(' | ')}\n\n`;
        }
      });
    } else {
      for (let i = 0; i < actualCount; i++) {
        const itemDesc = rawVal[`item_desc_${i}`] || 'Item details missing';
        detailsText += `${i + 1}. ${itemDesc}\n\n`;
      }
    }

    if (!detailsText || detailsText.trim() === '') {
      detailsText = '-\n';
    }

    const hasProof = (actualCount > 0 && entry.proof_documents.length > 0) || hasGlobalDocs;
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
          // Resolve against UPLOAD_DIR, the single source of truth for where
          // uploads live (same logic as the delete route in routes/applications).
          // Joining onto process.cwd() only worked while UPLOAD_DIR happened to
          // resolve to <cwd>/uploads; it broke once it pointed at the mounted volume.
          const relativePath = docInfo.file_path.startsWith('/uploads/')
            ? docInfo.file_path.replace('/uploads/', '')
            : docInfo.file_path;
          const docPath = path.resolve(process.env.UPLOAD_DIR || './uploads', relativePath);
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

  // ── Table with 2 distinct score columns and zero overlap ──
  const colW = [25, 140, 55, 105, 52, 52, 52, 75, 75, 75];
  const hdrs = [
    '#',
    'Faculty Name',
    'Dept',
    'Designation',
    'Teaching',
    'Research',
    'Service',
    'Original Score',
    'Reviewer Score',
    'Final Score'
  ];
  const totalTableWidth = colW.reduce((a, b) => a + b, 0);
  const startX = 40;
  const padding = 4;

  function drawConsolidatedHeader(currentY: number) {
    let maxH = 20;
    doc.font('Helvetica-Bold').fontSize(8);
    for (let i = 0; i < hdrs.length; i++) {
      const th = doc.heightOfString(hdrs[i], { width: colW[i] - 2 * padding, lineGap: 1 }) + 2 * padding;
      if (th > maxH) maxH = th;
    }

    doc.rect(startX, currentY, totalTableWidth, maxH).fillAndStroke('#f1f5f9', lineColor);
    let hx = startX;
    doc.fill(darkText).fontSize(8).font('Helvetica-Bold');
    hdrs.forEach((h, i) => {
      doc.rect(hx, currentY, colW[i], maxH).stroke(lineColor);
      const isRight = i >= 4; // Numeric score columns
      doc.text(h, hx + padding, currentY + padding, {
        width: colW[i] - 2 * padding,
        align: isRight ? 'right' : 'left',
        lineGap: 1,
      });
      hx += colW[i];
    });
    return currentY + maxH;
  }

  y = drawConsolidatedHeader(y);

  applications.forEach((app, idx) => {
    let teachingScore = 0;
    let researchScore = 0;
    let serviceScore = 0;
    let origScore = 0;

    app.category_entries.forEach(entry => {
      const calculatedVal = Number(entry.calculated_score);
      const section = entry.category.section;
      if (section === 'TEACHING') teachingScore += calculatedVal;
      else if (section === 'RESEARCH') researchScore += calculatedVal;
      else if (section === 'SERVICE') serviceScore += calculatedVal;
      origScore += calculatedVal;
    });

    const displayOrigTotal = app.total_score != null && Number(app.total_score) > 0 
      ? Number(app.total_score) 
      : origScore;

    const displayRevTotal = app.reviewer_score !== null 
      ? Number(app.reviewer_score) 
      : displayOrigTotal;

    const displayFinalTotal = app.final_score !== null && Number(app.final_score) > 0 
      ? Number(app.final_score) 
      : displayRevTotal;

    const row = [
      String(idx + 1),
      app.faculty.name,
      app.faculty.department?.code || 'N/A',
      designationLabels[app.faculty.designation || ''] || 'N/A',
      teachingScore.toFixed(1),
      researchScore.toFixed(1),
      serviceScore.toFixed(1),
      displayOrigTotal.toFixed(1),
      displayRevTotal.toFixed(1),
      displayFinalTotal.toFixed(1),
    ];

    // Measure max row height dynamically to prevent overlapping
    doc.font('Helvetica').fontSize(8);
    let maxRowHeight = 16;
    for (let i = 0; i < row.length; i++) {
      const th = doc.heightOfString(row[i] || ' ', { width: colW[i] - 2 * padding, lineGap: 1 }) + 2 * padding;
      if (th > maxRowHeight) maxRowHeight = th;
    }

    if (y + maxRowHeight > doc.page.height - 45) {
      doc.addPage();
      y = 40;
      y = drawConsolidatedHeader(y);
    }

    if (idx % 2 === 0) {
      doc.rect(startX, y, totalTableWidth, maxRowHeight).fill('#fafafa');
    }

    let rx = startX;
    row.forEach((val, i) => {
      doc.rect(rx, y, colW[i], maxRowHeight).stroke(lineColor);
      const isRight = i >= 4;
      
      let textColor = darkText;
      let textFont = 'Helvetica';
      if (i === 7) {
        textColor = '#2563eb'; // Original score blue
        textFont = 'Helvetica-Bold';
      } else if (i === 8) {
        textColor = '#d97706'; // Reviewer score amber
        textFont = 'Helvetica-Bold';
      } else if (i === 9) {
        textColor = '#059669'; // Final score emerald
        textFont = 'Helvetica-Bold';
      }

      doc.fill(textColor).font(textFont).fontSize(8);
      doc.text(val, rx + padding, y + padding, {
        width: colW[i] - 2 * padding,
        align: isRight ? 'right' : 'left',
        lineGap: 1,
      });
      rx += colW[i];
    });

    y += maxRowHeight;
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

// ─── Monthly Faculty Appraisal Report PDF (Approved / Rejected) ────────────────

export async function generateMonthlyReportPDF(filters: {
  month: number;
  year: number;
  department_id?: string;
}): Promise<PassThrough> {
  const month = Number(filters.month) || (new Date().getMonth() + 1);
  const year = Number(filters.year) || new Date().getFullYear();
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const monthName = startDate.toLocaleString('en-US', { month: 'long' });

  let deptName = 'All Departments';
  if (filters.department_id) {
    const d = await prisma.department.findUnique({ where: { id: filters.department_id } });
    if (d) deptName = `${d.name} (${d.code})`;
  }

  const facultyWhere: any = { role: Role.FACULTY };
  if (filters.department_id) {
    facultyWhere.department_id = filters.department_id;
  }

  const facultyMembers = await prisma.user.findMany({
    where: facultyWhere,
    include: {
      department: { select: { name: true, code: true } },
      applications: {
        include: {
          reviews: {
            orderBy: { reviewed_at: 'desc' },
            include: { reviewer: { select: { name: true, role: true } } },
          },
          category_entries: {
            select: { calculated_score: true, reviewer_score: true },
          },
        },
        orderBy: { updated_at: 'desc' },
      },
    },
    orderBy: [
      { department: { name: 'asc' } },
      { name: 'asc' },
    ],
  });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
  const stream = new PassThrough();
  doc.pipe(stream);

  const darkText = '#0f172a';
  const mutedText = '#475569';
  const lineColor = '#cbd5e1';

  // ── Process faculty data & metrics ──
  interface ProcessedFaculty {
    name: string;
    departmentCode: string;
    designation: string;
    submissionDate: string;
    origScore: string;
    revScore: string;
    finalScore: string;
    approvalStatus: 'APPROVED' | 'REJECTED' | 'UNDER REVIEW' | 'NOT SUBMITTED';
  }

  const rowsData: ProcessedFaculty[] = facultyMembers.map(faculty => {
    // Check if faculty has an application active or touched in this month or period
    const matchedApp = faculty.applications.find(a => {
      const subTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const upTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      const hasReviewInMonth = a.reviews.some(r => {
        const revTime = new Date(r.reviewed_at).getTime();
        return revTime >= startTime && revTime <= endTime;
      });
      return (subTime >= startTime && subTime <= endTime) ||
             (upTime >= startTime && upTime <= endTime) ||
             hasReviewInMonth;
    }) || faculty.applications[0]; // fallback to most recent application

    if (!matchedApp || matchedApp.status === ApplicationStatus.DRAFT) {
      return {
        name: faculty.name,
        departmentCode: faculty.department?.code || 'N/A',
        designation: designationLabels[faculty.designation || ''] || faculty.designation || 'Faculty',
        submissionDate: matchedApp?.created_at ? formatDate(matchedApp.created_at) : '—',
        origScore: matchedApp?.total_score != null && Number(matchedApp.total_score) > 0 ? Number(matchedApp.total_score).toFixed(1) : '—',
        revScore: '—',
        finalScore: '—',
        approvalStatus: matchedApp?.status === ApplicationStatus.DRAFT ? 'UNDER REVIEW' : 'NOT SUBMITTED',
      };
    }

    // Determine Approval Status
    let approvalStatus: 'APPROVED' | 'REJECTED' | 'UNDER REVIEW' | 'NOT SUBMITTED' = 'UNDER REVIEW';
    
    // Check decisions in reviews
    const principalReview = matchedApp.reviews.find(r => r.role_at_review === Role.PRINCIPAL);
    const hasRejectedReview = matchedApp.reviews.some(r => r.decision === 'REJECTED' || r.decision === 'NOT_RECOMMENDED');

    if (hasRejectedReview || (principalReview && principalReview.decision === 'REJECTED')) {
      approvalStatus = 'REJECTED';
    } else if (
      matchedApp.status === ApplicationStatus.FROZEN ||
      matchedApp.status === ApplicationStatus.SENT_TO_ACCOUNTS ||
      (principalReview && principalReview.decision === 'APPROVED')
    ) {
      approvalStatus = 'APPROVED';
    } else {
      approvalStatus = 'UNDER REVIEW';
    }

    // Scores
    const orig = matchedApp.total_score != null && Number(matchedApp.total_score) > 0
      ? Number(matchedApp.total_score)
      : matchedApp.category_entries.reduce((acc, e) => acc + Number(e.calculated_score), 0);
    const rev = matchedApp.reviewer_score != null ? Number(matchedApp.reviewer_score) : orig;
    const fin = matchedApp.final_score != null && Number(matchedApp.final_score) > 0 ? Number(matchedApp.final_score) : rev;

    return {
      name: faculty.name,
      departmentCode: faculty.department?.code || 'N/A',
      designation: designationLabels[faculty.designation || ''] || faculty.designation || 'Faculty',
      submissionDate: formatDate(matchedApp.submitted_at || matchedApp.created_at),
      origScore: orig.toFixed(1),
      revScore: rev.toFixed(1),
      finalScore: fin.toFixed(1),
      approvalStatus,
    };
  });

  const totalCount = rowsData.length;
  const approvedCount = rowsData.filter(r => r.approvalStatus === 'APPROVED').length;
  const rejectedCount = rowsData.filter(r => r.approvalStatus === 'REJECTED').length;
  const underReviewCount = rowsData.filter(r => r.approvalStatus === 'UNDER REVIEW').length;
  const notSubmittedCount = rowsData.filter(r => r.approvalStatus === 'NOT SUBMITTED').length;

  // ── Header ──
  doc.rect(0, 0, doc.page.width, 78).fill('#ffffff');
  doc.fill('#0f172a').fontSize(16).font('Helvetica-Bold')
    .text('RAMAIAH INSTITUTE OF TECHNOLOGY, BANGALORE', 40, 16, { align: 'center' });
  doc.fontSize(12).font('Helvetica-Bold').fill('#334155')
    .text(`MONTHLY FACULTY APPRAISAL STATUS REPORT — ${monthName.toUpperCase()} ${year}`, 40, 36, { align: 'center' });
  doc.fontSize(8.5).font('Helvetica').fill(mutedText)
    .text(`Department: ${deptName}   |   Period: 01 ${monthName} ${year} to ${endDate.getDate()} ${monthName} ${year}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`, 40, 56, { align: 'center' });

  try {
    const logoPath = path.join(__dirname, '../../assets/logo.png');
    doc.image(logoPath, doc.page.width - 110, 12, { width: 55 });
  } catch (err) {
    // Logo optional
  }

  let y = 84;

  // ── Summary Cards Bar ──
  const statBoxW = 142;
  const statBoxH = 28;
  const statsStartX = 45;

  // 1. Total Faculty
  doc.rect(statsStartX, y, statBoxW, statBoxH).fillAndStroke('#f8fafc', lineColor);
  doc.fill('#0f172a').font('Helvetica').fontSize(7.5).text('TOTAL FACULTY', statsStartX + 8, y + 4);
  doc.fill('#0f172a').font('Helvetica-Bold').fontSize(11).text(String(totalCount), statsStartX + 8, y + 14);

  // 2. Approved
  doc.rect(statsStartX + statBoxW + 10, y, statBoxW, statBoxH).fillAndStroke('#ecfdf5', '#86efac');
  doc.fill('#065f46').font('Helvetica').fontSize(7.5).text('APPROVED', statsStartX + statBoxW + 18, y + 4);
  doc.fill('#059669').font('Helvetica-Bold').fontSize(11).text(String(approvedCount), statsStartX + statBoxW + 18, y + 14);

  // 3. Rejected
  doc.rect(statsStartX + (statBoxW + 10) * 2, y, statBoxW, statBoxH).fillAndStroke('#fef2f2', '#fca5a5');
  doc.fill('#991b1b').font('Helvetica').fontSize(7.5).text('REJECTED', statsStartX + (statBoxW + 10) * 2 + 8, y + 4);
  doc.fill('#dc2626').font('Helvetica-Bold').fontSize(11).text(String(rejectedCount), statsStartX + (statBoxW + 10) * 2 + 8, y + 14);

  // 4. Under Review
  doc.rect(statsStartX + (statBoxW + 10) * 3, y, statBoxW, statBoxH).fillAndStroke('#fffbeb', '#fde68a');
  doc.fill('#92400e').font('Helvetica').fontSize(7.5).text('UNDER REVIEW', statsStartX + (statBoxW + 10) * 3 + 8, y + 4);
  doc.fill('#d97706').font('Helvetica-Bold').fontSize(11).text(String(underReviewCount), statsStartX + (statBoxW + 10) * 3 + 8, y + 14);

  // 5. Not Submitted
  doc.rect(statsStartX + (statBoxW + 10) * 4, y, statBoxW, statBoxH).fillAndStroke('#f1f5f9', '#cbd5e1');
  doc.fill('#475569').font('Helvetica').fontSize(7.5).text('NOT SUBMITTED', statsStartX + (statBoxW + 10) * 4 + 8, y + 4);
  doc.fill('#64748b').font('Helvetica-Bold').fontSize(11).text(String(notSubmittedCount), statsStartX + (statBoxW + 10) * 4 + 8, y + 14);

  y += 38;

  // ── Table Setup ──
  // Sum = 25 + 155 + 60 + 115 + 75 + 75 + 75 + 75 + 95 = 750 pt
  const colW = [25, 155, 60, 115, 75, 75, 75, 75, 95];
  const hdrs = [
    '#',
    'Faculty Name',
    'Dept',
    'Designation',
    'Submitted',
    'Original Score',
    'Reviewer Score',
    'Final Score',
    'Approval Status'
  ];
  const totalTableWidth = colW.reduce((a, b) => a + b, 0);
  const startX = 45;
  const padding = 4;

  function drawMonthlyHeader(currentY: number) {
    let maxH = 22;
    doc.font('Helvetica-Bold').fontSize(8);
    for (let i = 0; i < hdrs.length; i++) {
      const th = doc.heightOfString(hdrs[i], { width: colW[i] - 2 * padding, lineGap: 1 }) + 2 * padding;
      if (th > maxH) maxH = th;
    }

    doc.rect(startX, currentY, totalTableWidth, maxH).fillAndStroke('#f1f5f9', lineColor);
    let hx = startX;
    doc.fill(darkText).fontSize(8).font('Helvetica-Bold');
    hdrs.forEach((h, i) => {
      doc.rect(hx, currentY, colW[i], maxH).stroke(lineColor);
      const isRight = i >= 5 && i <= 7;
      const isCenter = i === 0 || i === 4 || i === 8;
      const align = isRight ? 'right' : isCenter ? 'center' : 'left';
      doc.text(h, hx + padding, currentY + padding, {
        width: colW[i] - 2 * padding,
        align,
        lineGap: 1,
      });
      hx += colW[i];
    });
    return currentY + maxH;
  }

  y = drawMonthlyHeader(y);

  rowsData.forEach((rowItem, idx) => {
    const row = [
      String(idx + 1),
      rowItem.name,
      rowItem.departmentCode,
      rowItem.designation,
      rowItem.submissionDate,
      rowItem.origScore,
      rowItem.revScore,
      rowItem.finalScore,
      rowItem.approvalStatus,
    ];

    doc.font('Helvetica').fontSize(8);
    let maxRowHeight = 17;
    for (let i = 0; i < row.length; i++) {
      const th = doc.heightOfString(row[i] || ' ', { width: colW[i] - 2 * padding, lineGap: 1 }) + 2 * padding;
      if (th > maxRowHeight) maxRowHeight = th;
    }

    if (y + maxRowHeight > doc.page.height - 40) {
      doc.addPage();
      y = 40;
      y = drawMonthlyHeader(y);
    }

    if (idx % 2 === 0) {
      doc.rect(startX, y, totalTableWidth, maxRowHeight).fill('#fafafa');
    }

    let rx = startX;
    row.forEach((val, i) => {
      const isRight = i >= 5 && i <= 7;
      const isCenter = i === 0 || i === 4 || i === 8;
      const align = isRight ? 'right' : isCenter ? 'center' : 'left';

      if (i === 8) {
        // Dedicated stylized Approval Status column (Approved / Rejected)
        let bgCol = '#f1f5f9';
        let strokeCol = '#cbd5e1';
        let txtCol = '#475569';
        if (rowItem.approvalStatus === 'APPROVED') {
          bgCol = '#ecfdf5';
          strokeCol = '#a7f3d0';
          txtCol = '#059669';
        } else if (rowItem.approvalStatus === 'REJECTED') {
          bgCol = '#fef2f2';
          strokeCol = '#fecaca';
          txtCol = '#dc2626';
        } else if (rowItem.approvalStatus === 'UNDER REVIEW') {
          bgCol = '#fffbeb';
          strokeCol = '#fde68a';
          txtCol = '#d97706';
        }

        doc.rect(rx, y, colW[i], maxRowHeight).fillAndStroke(bgCol, strokeCol);
        doc.fill(txtCol).font('Helvetica-Bold').fontSize(7.5);
        doc.text(val, rx + padding, y + padding + 1, {
          width: colW[i] - 2 * padding,
          align: 'center',
        });
      } else {
        doc.rect(rx, y, colW[i], maxRowHeight).stroke(lineColor);
        let textColor = darkText;
        let textFont = 'Helvetica';

        if (i === 5) {
          textColor = '#2563eb'; // Original score
          textFont = 'Helvetica-Bold';
        } else if (i === 6) {
          textColor = '#d97706'; // Reviewer score
          textFont = 'Helvetica-Bold';
        } else if (i === 7) {
          textColor = '#059669'; // Final score
          textFont = 'Helvetica-Bold';
        }

        doc.fill(textColor).font(textFont).fontSize(8);
        doc.text(val, rx + padding, y + padding, {
          width: colW[i] - 2 * padding,
          align,
          lineGap: 1,
        });
      }
      rx += colW[i];
    });

    y += maxRowHeight;
  });

  // Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fill(mutedText).fontSize(7).font('Helvetica')
      .text(
        `RIT Faculty Appraisal System — Monthly Report (${monthName} ${year}) | Page ${i + 1} of ${totalPages}`,
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
