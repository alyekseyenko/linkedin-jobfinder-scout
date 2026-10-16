import { jsPDF } from 'jspdf';
import { collectProfileLinks, parseTextSegments, type TextSegment } from './ats-linkify';

export type AtsPdfCv = {
  personal_info: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
  };
  target_headline?: string;
  summary?: string;
  core_competencies?: Record<string, string[] | undefined> | null;
  experience?: Array<{
    company: string;
    role: string;
    period: string;
    role_timeline?: Array<{ role: string; period: string }>;
    bullets?: string[];
  }>;
  selected_projects?: Array<{ name: string; impact?: string }>;
  hard_skills?: string[];
  education?: Array<string | { degree?: string; institution?: string; details?: string }>;
  certifications?: string[];
};

const COMPETENCY_LABELS: Record<string, string> = {
  leadership_and_delivery: 'Leadership & delivery',
  technical: 'Technical',
  platforms_and_tools: 'Platforms & tools'
};

const COLORS = {
  ink: [15, 23, 42] as [number, number, number],
  body: [51, 65, 85] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  accent: [2, 84, 130] as [number, number, number],
  accentLight: [224, 242, 254] as [number, number, number],
  headerBg: [248, 250, 252] as [number, number, number],
  rule: [203, 213, 225] as [number, number, number],
  ruleDark: [30, 41, 59] as [number, number, number]
};

function cleanCopy(text: string) {
  if (!text) return '';
  return text.replace(/\u2014|\u2013/g, '-').replace(/\s+/g, ' ').trim();
}

function normalizePdfText(text: string) {
  if (!text) return '';
  let t = cleanCopy(text);
  t = t.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  t = t.replace(/\u00b7/g, ', ');
  t = t.replace(/\u2022/g, '-');
  t = t.replace(/[`_*#]/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

function formatPeriod(period: string) {
  if (!period) return '';
  return period
    .replace(/\u2014|\u2013/g, ' - ')
    .replace(/\s+to\s+/gi, ' - ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatEdu(edu: string | { degree?: string; institution?: string; details?: string }) {
  if (typeof edu === 'string') return cleanCopy(edu);
  return cleanCopy(
    `${edu.degree || ''}${edu.institution ? `, ${edu.institution}` : ''}${edu.details ? ` (${edu.details})` : ''}`
  );
}

const PDF_MAX_BULLET_CHARS = 320;
const PDF_MAX_BULLETS_PER_ROLE = 4;
const PDF_MAX_PROJECTS = 2;
const PDF_MAX_SKILLS = 16;

function trimBulletAtSentence(text: string, maxLen: number) {
  const c = cleanCopy(text);
  if (c.length <= maxLen) return c.replace(/(\.\.)+$/, '').replace(/…+$/g, '');
  const slice = c.slice(0, maxLen);
  const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '));
  if (lastSentence >= Math.floor(maxLen * 0.5)) {
    return slice.slice(0, lastSentence + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  const cut = (lastSpace > 48 ? slice.slice(0, lastSpace) : slice).trim().replace(/[.,;:\s]+$/, '');
  return cut.endsWith('.') ? cut : `${cut}.`;
}

export function compactTailoredCvForPdf(cv: AtsPdfCv): AtsPdfCv {
  const trimBullet = (b: string) => trimBulletAtSentence(b, PDF_MAX_BULLET_CHARS);

  const experience = (cv.experience || []).map((exp) => ({
    ...exp,
    bullets: (exp.bullets || []).map(trimBullet).slice(0, PDF_MAX_BULLETS_PER_ROLE)
  }));

  const expText = experience.flatMap((e) => e.bullets || []).join(' ').toLowerCase();

  const selected_projects = (cv.selected_projects || [])
    .filter((p) => {
      const impact = cleanCopy(p.impact || '');
      if (!impact || impact.length < 50) return true;
      return !expText.includes(impact.slice(0, 72).toLowerCase());
    })
    .slice(0, PDF_MAX_PROJECTS);

  return {
    ...cv,
    experience,
    selected_projects,
    hard_skills: (cv.hard_skills || []).slice(0, PDF_MAX_SKILLS)
  };
};

type Layout = {
  marginX: number;
  marginTop: number;
  marginBottom: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  bottomLimit: number;
  scale: number;
  bodySize: number;
  bodyLeading: number;
  smallSize: number;
  sectionSize: number;
};

function makeLayout(doc: jsPDF, scale: number): Layout {
  const marginX = 18;
  const marginTop = 12;
  const marginBottom = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bodySize = 9 * scale;
  const bodyLeading = 4.1 * scale;
  const smallSize = 8 * scale;
  const sectionSize = 8.5 * scale;
  return {
    marginX,
    marginTop,
    marginBottom,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - marginX * 2,
    bottomLimit: pageHeight - marginBottom,
    scale,
    bodySize,
    bodyLeading,
    smallSize,
    sectionSize
  };
}

type LinePiece = { text: string; href?: string };

function wrapLinkifiedSegments(doc: jsPDF, segments: TextSegment[], maxWidth: number): LinePiece[][] {
  const lines: LinePiece[][] = [[]];
  let lineW = 0;

  const newLine = () => {
    lines.push([]);
    lineW = 0;
  };

  const append = (text: string, href?: string) => {
    if (!text) return;
    const w = doc.getTextWidth(text);
    if (lineW + w > maxWidth && lineW > 0) newLine();
    lines[lines.length - 1].push({ text, href });
    lineW += w;
  };

  for (const seg of segments) {
    if (seg.type === 'link') {
      append(seg.value, seg.href);
      continue;
    }
    const tokens = seg.value.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      append(token);
    }
  }

  return lines.filter((row) => row.length > 0);
}

function drawLinePieces(
  doc: jsPDF,
  pieces: LinePiece[],
  x: number,
  y: number,
  linkColor: [number, number, number],
  bodyColor: [number, number, number]
) {
  let cx = x;
  for (const piece of pieces) {
    if (piece.href) {
      doc.setTextColor(...linkColor);
      doc.textWithLink(piece.text, cx, y, { url: piece.href });
    } else {
      doc.setTextColor(...bodyColor);
      doc.text(piece.text, cx, y);
    }
    cx += doc.getTextWidth(piece.text);
  }
}

function drawLinkifiedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  leading: number,
  bottomLimit: number,
  bodyColor: [number, number, number] = COLORS.body,
  linkColor: [number, number, number] = COLORS.accent
): number {
  const normalized = normalizePdfText(text);
  if (!normalized) return y;
  const segments = parseTextSegments(normalized);
  const rows = wrapLinkifiedSegments(doc, segments, maxWidth);
  doc.setFont('helvetica', 'normal');
  for (const row of rows) {
    if (y + leading > bottomLimit) return y;
    drawLinePieces(doc, row, x, y, linkColor, bodyColor);
    y += leading;
  }
  return y;
}

function drawParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  leading: number,
  bottomLimit: number,
  bodyColor: [number, number, number] = COLORS.body
): number {
  return drawLinkifiedParagraph(doc, text, x, y, maxWidth, leading, bottomLimit, bodyColor, COLORS.accent);
}

function drawContactBlock(doc: jsPDF, cv: AtsPdfCv, y: number, L: Layout): number {
  const pi = cv.personal_info || {};
  const plainParts = [pi.location, pi.phone].filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(L.smallSize);
  const contactX = L.marginX + 5;

  if (plainParts.length) {
    doc.setTextColor(...COLORS.muted);
    y = drawParagraph(
      doc,
      plainParts.join('  ·  '),
      contactX,
      y + 0.8,
      L.contentWidth - 6,
      3.6 * L.scale,
      L.bottomLimit,
      COLORS.muted
    );
  }

  const profileLinks = collectProfileLinks(cv);
  if (!profileLinks.length) return y;

  const pieces: LinePiece[] = [];
  profileLinks.forEach((link, i) => {
    if (i > 0) pieces.push({ text: '  ·  ' });
    pieces.push({ text: link.label, href: link.href });
  });

  if (y + 3.6 * L.scale > L.bottomLimit) return y;
  drawLinePieces(doc, pieces, contactX, y, COLORS.accent, COLORS.muted);
  return y + 3.6 * L.scale;
}

function drawRowTitlePeriod(
  doc: jsPDF,
  leftBold: string,
  right: string,
  y: number,
  L: Layout
): number {
  const rightText = formatPeriod(right);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.bodySize);
  doc.setTextColor(...COLORS.ink);
  const rightW = doc.getTextWidth(rightText);
  const leftMax = L.contentWidth - rightW - 3;
  const leftLines = doc.splitTextToSize(normalizePdfText(leftBold), Math.max(leftMax, L.contentWidth * 0.45)) as string[];
  if (leftLines.length === 0) return y;

  doc.text(leftLines[0], L.marginX, y);
  if (rightText) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(rightText, L.pageWidth - L.marginX, y, { align: 'right' });
  }
  y += L.bodyLeading;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.ink);
  for (let i = 1; i < leftLines.length; i++) {
    if (y + L.bodyLeading > L.bottomLimit) return y;
    doc.text(leftLines[i], L.marginX, y);
    y += L.bodyLeading;
  }
  return y;
}

function drawBullet(
  doc: jsPDF,
  text: string,
  y: number,
  L: Layout
): number {
  const body = normalizePdfText(text);
  if (!body) return y;
  const indent = 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(L.bodySize);
  const segments = parseTextSegments(body);
  const rows = wrapLinkifiedSegments(doc, segments, L.contentWidth - indent);

  for (let i = 0; i < rows.length; i++) {
    if (y + L.bodyLeading > L.bottomLimit) return y;
    if (i === 0) {
      doc.setTextColor(...COLORS.body);
      doc.text('-', L.marginX, y);
      drawLinePieces(doc, rows[i], L.marginX + indent, y, COLORS.accent, COLORS.body);
    } else {
      drawLinePieces(doc, rows[i], L.marginX + indent, y, COLORS.accent, COLORS.body);
    }
    y += L.bodyLeading;
  }
  return y + 0.35 * L.scale;
}

function drawSection(doc: jsPDF, title: string, y: number, L: Layout): number | null {
  if (y + L.sectionSize + 6 > L.bottomLimit) return null;
  y += 3 * L.scale;
  const barH = 4.2 * L.scale;
  doc.setFillColor(...COLORS.accent);
  doc.rect(L.marginX, y - barH + 1.2, 1.4, barH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.sectionSize);
  doc.setTextColor(...COLORS.ink);
  doc.text(title.toUpperCase(), L.marginX + 3.5, y);
  y += 1.8 * L.scale;
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.15);
  doc.line(L.marginX, y, L.pageWidth - L.marginX, y);
  y += 4.2 * L.scale;
  return y;
}

function drawExperienceDivider(doc: jsPDF, y: number, L: Layout) {
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.1);
  doc.line(L.marginX + 2, y, L.pageWidth - L.marginX - 2, y);
}

function renderAtsPdfDocument(doc: jsPDF, cv: AtsPdfCv): number {
  const L = makeLayout(doc, (doc as unknown as { __atsScale?: number }).__atsScale ?? 1);
  let y = L.marginTop;
  const pi = cv.personal_info || {};
  const headerStartY = y;

  const name = normalizePdfText(pi.name || 'Candidate');
  const headline = cv.target_headline || pi.title || '';
  const headerReserve = 28 * L.scale + (headline ? 5 * L.scale : 0);

  doc.setFillColor(...COLORS.headerBg);
  doc.rect(L.marginX, y - 1, L.contentWidth, headerReserve, 'F');
  doc.setFillColor(...COLORS.accent);
  doc.rect(L.marginX, y - 1, 2.2, headerReserve, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20 * L.scale);
  doc.setTextColor(...COLORS.ink);
  doc.text(name, L.marginX + 5, y + 4);
  y += 9 * L.scale;

  if (headline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5 * L.scale);
    doc.setTextColor(...COLORS.accent);
    y = drawLinkifiedParagraph(
      doc,
      headline,
      L.marginX + 5,
      y,
      L.contentWidth - 6,
      4.3 * L.scale,
      headerStartY + headerReserve,
      COLORS.accent,
      COLORS.accent
    );
    y += 0.5 * L.scale;
  }

  y = drawContactBlock(doc, cv, y + 0.5, L);
  y = Math.max(y, headerStartY + headerReserve - 2);

  doc.setDrawColor(...COLORS.ruleDark);
  doc.setLineWidth(0.35);
  y += 2 * L.scale;
  doc.line(L.marginX, y, L.pageWidth - L.marginX, y);
  y += 5 * L.scale;

  const section = (title: string) => {
    const next = drawSection(doc, title, y, L);
    if (next === null) return false;
    y = next;
    return true;
  };

  if (cv.summary && section('Professional Summary')) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(L.bodySize);
    doc.setTextColor(...COLORS.body);
    y = drawParagraph(doc, cv.summary, L.marginX, y, L.contentWidth, L.bodyLeading, L.bottomLimit);
  }

  const comp = cv.core_competencies;
  const compLines: string[] = [];
  if (comp) {
    for (const [key, items] of Object.entries(comp)) {
      if (Array.isArray(items) && items.length) {
        const label = COMPETENCY_LABELS[key] || key.replace(/_/g, ' ');
        compLines.push(`${label}: ${items.slice(0, 6).join(', ')}`);
      }
    }
  }
  if (compLines.length && section('Core Competencies')) {
    doc.setFontSize(L.smallSize);
    doc.setTextColor(...COLORS.body);
    for (const line of compLines) {
      const before = y;
      y = drawParagraph(doc, line, L.marginX, y, L.contentWidth, 3.5 * L.scale, L.bottomLimit);
      if (y === before) break;
    }
  }

  if ((cv.hard_skills?.length ?? 0) > 0 && section('Technical Skills')) {
    doc.setFontSize(L.smallSize);
    doc.setTextColor(...COLORS.body);
    y = drawParagraph(
      doc,
      (cv.hard_skills || []).join(' · '),
      L.marginX,
      y,
      L.contentWidth,
      3.5 * L.scale,
      L.bottomLimit
    );
  }

  if (section('Professional Experience')) {
    const exps = cv.experience || [];
    for (let ei = 0; ei < exps.length; ei++) {
      const exp = exps[ei];
      if (y + L.bodyLeading * 4 > L.bottomLimit) break;
      if (ei > 0) {
        y += 1.2 * L.scale;
        drawExperienceDivider(doc, y, L);
        y += 2.2 * L.scale;
      }

      const timeline = exp.role_timeline?.length ? exp.role_timeline : null;
      if (timeline) {
        y = drawRowTitlePeriod(doc, cleanCopy(exp.company), exp.period, y, L);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(L.smallSize);
        doc.setTextColor(...COLORS.muted);
        for (const rt of timeline) {
          const row = `${formatPeriod(rt.period)}  ·  ${cleanCopy(rt.role)}`;
          const before = y;
          y = drawParagraph(doc, row, L.marginX + 2, y, L.contentWidth - 2, 3.4 * L.scale, L.bottomLimit);
          if (y === before) break;
        }
      } else {
        y = drawRowTitlePeriod(doc, cleanCopy(exp.role), exp.period, y, L);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(L.smallSize);
        doc.setTextColor(...COLORS.muted);
        y = drawParagraph(
          doc,
          cleanCopy(exp.company),
          L.marginX,
          y,
          L.contentWidth,
          3.4 * L.scale,
          L.bottomLimit
        );
      }

      for (const b of exp.bullets || []) {
        const before = y;
        y = drawBullet(doc, b, y + 0.3 * L.scale, L);
        if (y === before) break;
      }
      y += 1.8 * L.scale;
    }
  }

  const projects = cv.selected_projects || [];
  if (projects.length && section('Selected Projects')) {
    for (const p of projects) {
      const line = p.impact ? `${p.name}: ${p.impact}` : p.name;
      const before = y;
      y = drawBullet(doc, line || '', y, L);
      if (y === before) break;
    }
  }

  const eduCerts = [
    ...(cv.education || []).map(formatEdu),
    ...(cv.certifications || []).map((c) => cleanCopy(c))
  ].filter(Boolean);

  if (eduCerts.length && section('Education & Certifications')) {
    doc.setFontSize(L.smallSize);
    doc.setTextColor(...COLORS.body);
    for (const line of eduCerts) {
      const before = y;
      y = drawBullet(doc, line, y, L);
      if (y === before) break;
    }
  }

  return y;
}

export function downloadAtsCvPdf(
  cv: AtsPdfCv,
  fileBase: string,
  _options?: { targetRole?: string; targetCompany?: string }
) {
  const compact = compactTailoredCvForPdf(cv);
  const scales = [1, 0.94, 0.88, 0.82, 0.76];

  for (const scale of scales) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    (doc as unknown as { __atsScale?: number }).__atsScale = scale;
    const endY = renderAtsPdfDocument(doc, compact);
    const bottom = doc.internal.pageSize.getHeight() - 12;
    const fits = endY <= bottom;
    if (fits || scale === scales[scales.length - 1]) {
      const safe = fileBase.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
      doc.save(`${safe || 'ATS_CV'}.pdf`);
      return;
    }
  }
}
