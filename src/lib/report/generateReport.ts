/**
 * Court-ready PDF report generation.
 *
 * Assembles a complete, printable report from a case and its computed scene
 * analysis: case information, bloodstain measurements, calculated results
 * (convergence, area of origin, stringing), the auto-generated sketches, notes,
 * and a signature page. Built with jsPDF + autotable.
 *
 * The function is deliberately free of React/DOM concerns beyond consuming
 * pre-rendered sketch images (data URLs), so the report layout is testable and
 * could later run server-side for scheduled or bulk export.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Case } from '@/types';
import type { SceneAnalysis } from '@/lib/calculations';
import { formatLength } from '@/lib/calculations';
import { categoryCounts, patternLabel } from '@/lib/bpa/patterns';
import { buildMethodology } from '@/lib/bpa/methodology';

export interface ReportSketchImages {
  /** PNG data URL of the top-view sketch. */
  topView?: string;
  /** PNG data URL of the wall-elevation sketch. */
  elevation?: string;
  /** Human label for the elevation wall, e.g. "North wall". */
  elevationLabel?: string;
}

const MARGIN = 40; // pt
const LINE = 16;

export function generateReportDoc(
  kase: Case,
  analysis: SceneAnalysis,
  images: ReportSketchImages = {},
): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  const system = kase.unitSystem;

  // ---- Title block ----
  let y = MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Bloodstain Pattern Analysis Report', MARGIN, y);
  y += LINE + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Case ${kase.caseNumber || '—'}`, MARGIN, y);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - MARGIN, y, { align: 'right' });
  doc.setTextColor(0);
  y += LINE;

  // ---- Case information ----
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 10, cellPadding: 4 },
    head: [['Case information', '']],
    body: [
      ['Case number', kase.caseNumber || '—'],
      ['Agency', kase.agency || '—'],
      ['Investigator', kase.investigator || '—'],
      ['Date', kase.date || '—'],
      ['Location', kase.location || '—'],
      ['Units', system === 'metric' ? 'Metric (cm)' : 'Imperial (in)'],
      ['Victim', kase.victim?.name || '—'],
      ['Suspect', kase.suspect?.name || '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTableY(doc);

  if (kase.notes) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Notes', MARGIN, y);
    y += LINE - 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(kase.notes, contentWidth);
    doc.text(lines, MARGIN, y);
    y += lines.length * (LINE - 4);
  }

  // ---- Bloodstain measurements ----
  const stainRows = kase.stains.map((s) => {
    const c = analysis.stainResults[s.id];
    return [
      s.stainId,
      s.surface,
      patternLabel(s.patternType),
      formatLength(s.width, system),
      formatLength(s.length, system),
      c && Number.isFinite(c.widthToLengthRatio) ? c.widthToLengthRatio.toFixed(3) : '—',
      c?.impactAngleDeg == null ? 'check' : `${c.impactAngleDeg.toFixed(1)}°`,
      typeof s.directionality === 'number' ? `${s.directionality.toFixed(0)}°` : '—',
    ];
  });

  autoTable(doc, {
    startY: y + 12,
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 8, cellPadding: 3 },
    head: [['Stain', 'Surface', 'Pattern', 'Width', 'Length', 'W:L', 'Impact ∠', 'Dir.']],
    body: stainRows.length ? stainRows : [['—', '—', '—', '—', '—', '—', '—', '—']],
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTableY(doc);

  // ---- Pattern classification breakdown ----
  if (kase.stains.length) {
    const counts = categoryCounts(kase.stains.map((s) => s.patternType));
    autoTable(doc, {
      startY: y + 12,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 9, cellPadding: 3 },
      head: [['Pattern classification', 'Count']],
      body: [
        ['Passive', String(counts.passive)],
        ['Spatter (impact / projected)', String(counts.spatter)],
        ['Transfer / contact', String(counts.transfer)],
        ['Altered', String(counts.altered)],
        ['Other / unclassified', String(counts.other + kase.stains.filter((s) => !s.patternType).length)],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 220 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTableY(doc);
  }

  // ---- Calculated results ----
  const conv = analysis.convergence;
  const origin = analysis.origin;
  autoTable(doc, {
    startY: y + 12,
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 10, cellPadding: 4 },
    head: [['Calculated results', '']],
    body: [
      [
        'Area of convergence',
        conv ? `(${conv.point.x.toFixed(0)}, ${conv.point.y.toFixed(0)}) mm · RMS ${conv.rmsError.toFixed(0)} mm` : 'Insufficient data',
      ],
      [
        'Estimated area of origin height',
        origin ? `${formatLength(origin.meanHeight, system)} ± ${formatLength(origin.heightStdDev, system)} (1σ)` : '—',
      ],
      ['Stains used in reconstruction', conv ? String(conv.lineCount) : '0'],
      ['Excluded stains', String(analysis.excludedStainIds.length)],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 200 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTableY(doc);

  // ---- Stringing detail (per-stain) ----
  if (origin && origin.strings.length) {
    autoTable(doc, {
      startY: y + 12,
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 9, cellPadding: 3 },
      head: [['Stain', 'Horiz. dist', 'Height', 'String length', 'Azimuth', 'Elevation']],
      body: origin.strings.map((st) => [
        st.stainId,
        formatLength(st.horizontalDistance, system),
        formatLength(st.heightEstimate, system),
        formatLength(st.stringLength, system),
        `${st.azimuthDeg.toFixed(0)}°`,
        `${st.elevationDeg.toFixed(1)}°`,
      ]),
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTableY(doc);
  }

  // ---- Sketches ----
  if (images.topView) {
    doc.addPage();
    y = MARGIN;
    y = addImageSection(doc, 'Top view (floor plan)', images.topView, y, contentWidth);
  }
  if (images.elevation) {
    if (y > doc.internal.pageSize.getHeight() - 220) {
      doc.addPage();
      y = MARGIN;
    } else {
      y += 20;
    }
    addImageSection(doc, images.elevationLabel || 'Wall elevation', images.elevation, y, contentWidth);
  }

  // ---- Calculation methodology appendix ----
  addMethodology(doc, kase, analysis);

  // ---- Signature page ----
  addSignaturePage(doc, kase);

  // ---- Footer page numbers ----
  addPageNumbers(doc);

  return doc;
}

/** Build the report and trigger a browser download. */
export function downloadReport(
  kase: Case,
  analysis: SceneAnalysis,
  images: ReportSketchImages = {},
): void {
  const doc = generateReportDoc(kase, analysis, images);
  const safe = (kase.caseNumber || 'case').replace(/[^\w.-]+/g, '_');
  doc.save(`BPA_Report_${safe}.pdf`);
}

// --- helpers ---

/** y position just below the most recently drawn autotable. */
function afterTableY(doc: jsPDF): number {
  // jspdf-autotable stashes the last table on the doc instance.
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return last ? last.finalY : MARGIN;
}

function addImageSection(
  doc: jsPDF,
  title: string,
  dataUrl: string,
  y: number,
  contentWidth: number,
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, MARGIN, y);
  y += 10;

  const props = doc.getImageProperties(dataUrl);
  const ratio = props.height / props.width;
  const w = contentWidth;
  const h = w * ratio;
  doc.addImage(dataUrl, 'PNG', MARGIN, y, w, h);
  return y + h;
}

function addMethodology(doc: jsPDF, kase: Case, analysis: SceneAnalysis): void {
  const sections = buildMethodology(kase, analysis);
  doc.addPage();
  let y = MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Appendix — Calculation methodology', MARGIN, y);
  y += LINE + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text('Formula, inputs, and result for every derived value. Lengths in mm.', MARGIN, y);
  doc.setTextColor(0);
  y += 6;

  for (const section of sections) {
    const body = section.lines.map((line) => [
      line.label,
      [line.formula, line.substitution ? `= ${line.substitution}` : null, line.result ? `= ${line.result}` : null, line.note]
        .filter(Boolean)
        .join('\n'),
    ]);
    autoTable(doc, {
      startY: y + 10,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      head: [[section.title, '']],
      body: body.length ? body : [['—', '—']],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTableY(doc);
  }
}

function addSignaturePage(doc: jsPDF, kase: Case): void {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Certification', MARGIN, y);
  y += LINE + 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const statement =
    'I certify that the measurements and analysis in this report were performed by me or under my ' +
    'direct supervision and accurately reflect the bloodstain evidence documented for this case.';
  const lines = doc.splitTextToSize(statement, pageWidth - MARGIN * 2);
  doc.text(lines, MARGIN, y);
  y += lines.length * (LINE - 4) + 40;

  const sigLine = (label: string, prefill?: string) => {
    doc.line(MARGIN, y, MARGIN + 260, y);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(label, MARGIN, y + 14);
    doc.setTextColor(0);
    if (prefill) {
      doc.setFontSize(11);
      doc.text(prefill, MARGIN, y - 6);
    }
    y += 70;
  };

  sigLine('Investigator signature', kase.investigator);
  sigLine('Date');
  sigLine('Reviewed by (name & title)');
  sigLine('Reviewer signature / date');
}

function addPageNumbers(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${total}`, pageWidth - MARGIN, pageHeight - 20, { align: 'right' });
    doc.setTextColor(0);
  }
}
