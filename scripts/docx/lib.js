// Bộ dựng .docx theo định dạng Khoa CNTT SGU: A4, TNR 13, giãn dòng 1.3, lề T/D 2.5 – Trái 3.5 – Phải 2.0 cm.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel,
  LevelFormat, BorderStyle, ShadingType, PageNumber, Footer, Header, TabStopType, ImageRun, PageBreak, TableOfContents, LineRuleType, PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
} = require('docx');
const fs = require('fs');
const path = require('path');
const LINE = 360; // giãn dòng 1.5 như báo cáo mẫu (CHƯƠNG 1.docx)

const CM = 567; // DXA per cm
const FONT = 'Times New Roman';
const SIZE = 26; // 13pt

const PLACEHOLDERS = { '«TV1»': '[Họ tên Nhóm trưởng]', '«TV2»': '[Họ tên TV2 – Backend]', '«TV3»': '[Họ tên TV3 – Frontend]', '«TV4»': '[Họ tên TV4 – Realtime & AI]', '«TV5»': '[Họ tên TV5 – DevOps & QA]' };

/** Inline markdown → TextRun[]: **bold**, *italic*, `code`, «TVn» tô vàng, [text](url) → text. */
function runs(text, base = {}) {
  const short = base.short; delete base.short;
  const out = [];
  let s = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|«TV[1-5]»)/g;
  let last = 0; let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(new TextRun({ text: s.slice(last, m.index), font: FONT, size: SIZE, ...base }));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, font: FONT, size: SIZE, ...base }));
    else if (tok.startsWith('`')) out.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', size: SIZE - 2, ...base }));
    else if (tok.startsWith('«')) out.push(new TextRun({ text: short ? tok.replace('«', '[').replace('»', ']') : (PLACEHOLDERS[tok] || tok), highlight: 'yellow', bold: true, font: FONT, size: SIZE, ...base }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, font: FONT, size: SIZE, ...base }));
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(new TextRun({ text: s.slice(last), font: FONT, size: SIZE, ...base }));
  return out;
}

const para = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), alignment: opts.align || AlignmentType.JUSTIFIED, spacing: { line: LINE, lineRule: LineRuleType.AUTO, after: 100, ...(opts.spacing || {}) }, ...(opts.numbering ? { numbering: opts.numbering } : {}), ...(opts.indent ? { indent: opts.indent } : {}) });
/** Mục cấp 1 in hoa đậm 14pt, cấp 2 đậm 13pt, cấp 3 đậm nghiêng — theo báo cáo mẫu. */
const heading = (text, level) => new Paragraph({
  children: runs(level === 1 ? text.toUpperCase() : text, { bold: true, italics: level === 3, size: level === 1 ? 28 : 26 }),
  heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
  spacing: { before: level === 1 ? 360 : 240, after: 120, line: LINE, lineRule: LineRuleType.AUTO }, keepNext: true,
});

function table(headers, rows, widthsCm) {
  const total = widthsCm.reduce((a, b) => a + b, 0);
  const widths = widthsCm.map((w) => Math.round(w * CM));
  const cell = (text, isHeader, w) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: runs(text, { bold: isHeader, size: 24, short: true }), alignment: AlignmentType.LEFT, spacing: { line: 276, lineRule: LineRuleType.AUTO, after: 0 } })],
    verticalAlign: 'center',
  });
  return new Table({
    width: { size: Math.round(total * CM), type: WidthType.DXA },
    columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, true, widths[i])) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, false, widths[i])) }))],
  });
}

/** Chuyển Markdown đơn giản (#, ##, ###, đoạn, - danh sách, 1. danh sách, | bảng, > trích) thành phần tử docx. */
function markdownToDocx(md, { skipFirstHeading = false, tableWidths = {}, shiftHeadings = true } = {}) {
  const lines = md.split('\n');
  const els = [];
  let i = 0; let firstHeadingSeen = false; let tableIdx = 0;
  const flushParagraph = (buf) => { if (buf.length) els.push(para(buf.join(' '))); };
  let buf = [];
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,3} /.test(line)) {
      flushParagraph(buf); buf = [];
      const level = line.match(/^(#{1,3}) /)[1].length;
      if (level === 1 && skipFirstHeading && !firstHeadingSeen) { firstHeadingSeen = true; i += 1; continue; }
      els.push(heading(line.replace(/^#{1,3} /, ''), shiftHeadings && skipFirstHeading ? Math.max(1, level - 1) : level)); i += 1; continue;
    }
    if (/^\|/.test(line)) {
      flushParagraph(buf); buf = [];
      const rowsRaw = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rowsRaw.push(lines[i]); i += 1; }
      const parse = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = parse(rowsRaw[0]);
      const body = rowsRaw.slice(2).map(parse);
      const widths = tableWidths[tableIdx] || Array(header.length).fill(15.5 / header.length);
      els.push(table(header, body, widths)); els.push(new Paragraph({ spacing: { after: 120 } }));
      tableIdx += 1; continue;
    }
    if (/^\s*[-*] /.test(line)) { flushParagraph(buf); buf = []; els.push(para(line.replace(/^\s*[-*] /, ''), { numbering: { reference: 'bullets', level: (line.match(/^\s*/)[0].length >= 2 ? 1 : 0) } })); i += 1; continue; }
    if (/^\s*\d+\. /.test(line)) { flushParagraph(buf); buf = []; els.push(para(line.replace(/^\s*\d+\. /, ''), { numbering: { reference: 'numbers', level: 0 } })); i += 1; continue; }
    if (/^> /.test(line)) { flushParagraph(buf); buf = []; els.push(para(line.replace(/^> /, ''), { run: { italics: true, color: '555555' }, indent: { left: 567 } })); i += 1; continue; }
    if (/^---/.test(line)) { flushParagraph(buf); buf = []; i += 1; continue; }
    if (line.trim() === '') { flushParagraph(buf); buf = []; i += 1; continue; }
    buf.push(line.trim()); i += 1;
  }
  flushParagraph(buf);
  return els;
}

function buildDoc(children, { title, headerText }) {
  return new Document({
    creator: 'Nhóm SmartTask', title,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: SIZE }, paragraph: { spacing: { line: LINE, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { spacing: { before: 360, after: 120, line: LINE, lineRule: LineRuleType.AUTO }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 240, after: 120, line: LINE, lineRule: LineRuleType.AUTO }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, italics: true }, paragraph: { spacing: { before: 200, after: 100, line: LINE, lineRule: LineRuleType.AUTO }, outlineLevel: 2 } },
        { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 } } },
        { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26 }, paragraph: { indent: { left: 440 }, spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 } } },
        { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26 }, paragraph: { indent: { left: 880 }, spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 } } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [
          { level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '+', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 2.5 * CM, bottom: 2.5 * CM, left: 3.5 * CM, right: 2 * CM } }, titlePage: true },
      headers: {
        first: new Header({ children: [new Paragraph({})] }),
        default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: headerText, font: FONT, size: 20, italics: true, color: '666666' })], alignment: AlignmentType.RIGHT })] }),
      },
      footers: {
        first: new Footer({ children: [new Paragraph({})] }),
        default: new Footer({ children: [new Paragraph({ children: [new TextRun({ children: ['Trang ', PageNumber.CURRENT], font: FONT, size: 22 })], alignment: AlignmentType.CENTER })] }),
      },
      children,
    }],
  });
}

/** Ô ký tên: nhiều dòng trống để ký, không kẻ viền. */
function signatureTable(cols) {
  const w = Math.round((15.5 / cols.length) * CM);
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const borders = { top: none, bottom: none, left: none, right: none };
  return new Table({
    width: { size: w * cols.length, type: WidthType.DXA }, columnWidths: cols.map(() => w),
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: cols.map((c) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders, children: [
      new Paragraph({ children: runs(c.title, { bold: true }), alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
      new Paragraph({ children: runs(c.note, { italics: true, size: 22 }), alignment: AlignmentType.CENTER, spacing: { after: 1200 } }),
      new Paragraph({ children: runs(c.name), alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    ] })) })],
  });
}

/** Ba dòng đầu trang + gạch ngang, theo bìa báo cáo mẫu của Khoa. */
function letterhead() {
  const c = (t) => new Paragraph({ children: runs(t, { bold: true, size: 26 }), alignment: AlignmentType.CENTER, spacing: { after: 0, line: 360, lineRule: LineRuleType.AUTO } });
  return [
    c('ỦY BAN NHÂN DÂN TP HỒ CHÍ MINH'),
    c('TRƯỜNG ĐẠI HỌC SÀI GÒN'),
    c('KHOA CÔNG NGHỆ THÔNG TIN'),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, indent: { left: 3100, right: 3100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 1 } } }),
  ];
}

/**
 * Trang bìa theo CHƯƠNG 1.docx: đầu trang → logo SGU → dòng sinh viên → tiêu đề lớn 28pt → bảng thông tin (nhãn : giá trị) → nơi/tháng.
 */
function coverPage({ studentLines, titleLines, subtitle, info, placeDate }) {
  const logo = fs.readFileSync(path.join(__dirname, 'assets', 'sgu-logo.png'));
  const c = (children, after = 0, extra = {}) => new Paragraph({ children, alignment: AlignmentType.CENTER, spacing: { after, line: 360, lineRule: LineRuleType.AUTO, ...extra } });
  const infoW = [Math.round(5.2 * CM), Math.round(9.3 * CM)];
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nb = { top: none, bottom: none, left: none, right: none };
  const infoTable = new Table({
    width: { size: infoW[0] + infoW[1], type: WidthType.DXA }, columnWidths: infoW, indent: { size: Math.round(1.0 * CM), type: WidthType.DXA },
    borders: { ...nb, insideHorizontal: none, insideVertical: none },
    rows: info.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: infoW[0], type: WidthType.DXA }, borders: nb, children: [new Paragraph({ children: runs(k, { bold: true }), spacing: { after: 0, line: 360, lineRule: LineRuleType.AUTO } })] }),
      new TableCell({ width: { size: infoW[1], type: WidthType.DXA }, borders: nb, children: [new Paragraph({ children: [new TextRun({ text: ': ', bold: true, font: FONT, size: SIZE }), ...runs(v, { bold: true })], spacing: { after: 0, line: 360, lineRule: LineRuleType.AUTO } })] }),
    ] })),
  });
  return [
    ...letterhead(),
    new Paragraph({ children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 98, height: 99 } })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 360, line: 240, lineRule: LineRuleType.AUTO } }),
    ...studentLines.map((l) => c(runs(l, { bold: true }), 0)),
    new Paragraph({ spacing: { after: 240 } }),
    ...titleLines.map((t) => c(runs(t, { bold: true, size: 56 }), 0)),
    ...(subtitle ? [new Paragraph({ spacing: { after: 120 } }), ...subtitle.map((t) => c(runs(t, { bold: true, size: 30 }), 0))] : []),
    new Paragraph({ spacing: { after: 360 } }),
    infoTable,
    new Paragraph({ spacing: { after: 700 } }),
    c(runs(placeDate, { bold: true, italics: true }), 0),
  ];
}

/** Mục lục tĩnh (số trang lấy từ bản PDF dựng thử) — hiện đúng trên mọi trình xem, không cần cập nhật field. */
function tocStatic(entries) {
  const line = (e) => new Paragraph({
    pageBreakBefore: false,
    indent: { left: e.level === 1 ? 0 : e.level === 2 ? 440 : 880 },
    spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: Math.round(15.5 * CM), leader: 'dot' }],
    children: [
      new TextRun({ text: e.text, font: FONT, size: 26, bold: e.level === 1 }),
      new TextRun({ text: `\t${e.page}`, font: FONT, size: 26, bold: e.level === 1 }),
    ],
  });
  return [
    new Paragraph({ pageBreakBefore: true, children: runs('MỤC LỤC', { bold: true, size: 32 }), alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
    ...entries.map(line),
  ];
}

/** Thu thập mục lục từ Markdown: (#, ##, ###) sau tiêu đề đầu tiên. */
function tocEntriesFromMarkdown(md) {
  const out = [];
  let first = true;
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,3}) (.+)$/);
    if (!m) continue;
    if (m[1].length === 1 && first) { first = false; continue; }
    const text = m[2].replace(/\*\*/g, '').replace(/`/g, '');
    const level = Math.max(1, m[1].length - 1);
    out.push({ level, text: level === 1 ? text.toUpperCase() : text, page: '?' });
  }
  return out;
}

module.exports = { signatureTable, letterhead, coverPage, tocStatic, tocEntriesFromMarkdown, Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, CM, FONT, SIZE, runs, para, heading, table, markdownToDocx, buildDoc, PLACEHOLDERS };
