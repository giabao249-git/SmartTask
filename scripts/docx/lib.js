// Bộ dựng .docx theo định dạng Khoa CNTT SGU: A4, TNR 13. Hai chế độ: 'report' (bìa CHƯƠNG 1.docx, mục lục, giãn 1.5)
// và 'template' (mẫu Mau_DeCuong.docx: mục 1..10 đậm 13pt, thụt đầu dòng 1,27 cm, giãn 1.4, không mục lục).
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel,
  LevelFormat, BorderStyle, ShadingType, PageNumber, Footer, Header, TabStopType, ImageRun, PageBreak, TableOfContents, LineRuleType, PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
  NumberFormat, PageOrientation, TableLayoutType,
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

const para = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), alignment: opts.align || AlignmentType.JUSTIFIED, spacing: { line: opts.line || LINE, lineRule: LineRuleType.AUTO, after: 100, ...(opts.spacing || {}) }, ...(opts.numbering ? { numbering: opts.numbering } : {}), ...(opts.indent ? { indent: opts.indent } : {}), ...(opts.keepNext ? { keepNext: true } : {}) });
/** Mục cấp 1 in hoa đậm 14pt, cấp 2 đậm 13pt, cấp 3 đậm nghiêng — theo báo cáo mẫu. */
const heading = (text, level, mode = 'report', extra = {}) => (mode === 'template'
  ? new Paragraph({
    children: runs(text, { bold: true, size: 26 }),
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    alignment: AlignmentType.JUSTIFIED, indent: level === 1 ? undefined : { firstLine: 720 },
    spacing: { before: level === 1 ? 200 : 80, after: 80, line: 336, lineRule: LineRuleType.AUTO }, keepNext: true,
  })
  : new Paragraph({
    children: runs(level === 1 ? text.toUpperCase() : text, { bold: true, italics: level === 3, size: level === 1 ? 28 : 26 }),
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    // Tiêu đề cấp 1 (chương, phần đầu, TLTK, phụ lục) canh giữa; cấp 2–3 canh trái trừ khi extra.center
    ...(level === 1 || extra.center ? { alignment: AlignmentType.CENTER } : {}),
    spacing: { before: level === 1 ? 360 : 240, after: level === 1 ? 360 : 120, line: LINE, lineRule: LineRuleType.AUTO }, keepNext: true,
    ...(level === 1 || extra.pageBreakBefore ? { pageBreakBefore: true } : {}),
  }));

/** Kích thước PNG (đọc IHDR) để tính tỷ lệ khi chèn vào Word. */
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const PX_PER_CM = 96 / 2.54; // docx-js tính kích thước ảnh theo px ở 96 dpi

/** Dòng ghi nguồn dưới hình/bảng: "Nguồn: …", nghiêng 12 pt, canh giữa. */
const sourceLine = (text, { after = 200, before = 40 } = {}) => new Paragraph({
  children: runs(text.trim(), { italics: true, size: 24 }),
  alignment: AlignmentType.CENTER,
  spacing: { before, after, line: 276, lineRule: LineRuleType.AUTO },
});

/**
 * Hình + chú thích: ảnh canh giữa, co vừa khung; chú thích "Hình x.y. …" nghiêng 13 pt ở dưới, rồi dòng nguồn (nếu có).
 * Trang dọc: khung 15,5 × 22,5 cm, không phóng to ảnh nhỏ (ảnh coi như 2x). Trang ngang (landscape): khung 24,7 × 14,2 cm,
 * được phóng to cho vừa khung — phần còn lại của vùng in 15,5 cm dành cho chú thích và dòng nguồn.
 */
function figure(filePath, caption, { mode = 'report', maxWidthPx = 586, maxHeightPx = mode === 'template' ? 760 : 850, retina = 2, source = null, landscape = false, maxHeightCm = null } = {}) {
  const buf = fs.readFileSync(filePath);
  const { w, h } = pngSize(buf);
  let width; let height;
  if (landscape) {
    const k = Math.min((24.7 * PX_PER_CM) / w, (14.2 * PX_PER_CM) / h);
    width = Math.round(w * k); height = Math.round(h * k);
  } else {
    const nw = w / retina; const nh = h / retina;
    const capH = maxHeightCm ? Math.min(maxHeightPx, maxHeightCm * PX_PER_CM) : maxHeightPx; // {cao=…}: trần riêng của hình
    const k = Math.min(maxWidthPx / nw, capH / nh, 1);
    width = Math.round(nw * k); height = Math.round(nh * k);
  }
  const T = mode === 'template';
  return [
    new Paragraph({
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width, height } })],
      alignment: AlignmentType.CENTER, keepNext: true,
      spacing: { before: landscape ? 0 : 160, after: landscape ? 20 : 60, line: 240, lineRule: LineRuleType.AUTO },
    }),
    new Paragraph({
      children: runs(caption, { italics: true, size: T ? 24 : 26 }),
      alignment: AlignmentType.CENTER, ...(source ? { keepNext: true } : {}),
      spacing: { before: 0, after: source ? 0 : (T ? 120 : 200), line: 276, lineRule: LineRuleType.AUTO },
    }),
    ...(source ? [sourceLine(source, { after: landscape ? 0 : 200, before: landscape ? 0 : 40 })] : []),
  ];
}

/** Công thức đánh số: nội dung canh giữa, số (3.1) sát lề phải. */
const formula = (text, num) => new Paragraph({
  tabStops: [{ type: TabStopType.CENTER, position: Math.round(7.75 * CM) }, { type: TabStopType.RIGHT, position: Math.round(15.5 * CM) }],
  spacing: { before: 80, after: 80, line: LINE, lineRule: LineRuleType.AUTO },
  children: [new TextRun({ text: '\t', font: FONT, size: SIZE }), ...runs(text), new TextRun({ text: `\t(${num})`, font: FONT, size: SIZE })],
});

// Chuỗi dài không khoảng trắng (tên cột, đường dẫn API, tên ràng buộc, kiểu enum) được chèn điểm ngắt mềm U+200B
// sau _ . / , ( = { } - và giữa chữ thường–chữ hoa (chuỗi ≥ 16 ký tự), để xuống dòng trong ô thay vì nới cột.
const softBreak = (s) => s.replace(/\S{12,}/g, (w) => {
  let x = w.replace(/([_./,(={}-])(?=\S)/g, '$1\u200B');
  if (w.length >= 16) x = x.replace(/([a-z])(?=[A-Z])/g, '$1\u200B');
  return x;
});

/**
 * Bảng: tiêu đề cột lặp lại khi bảng sang trang; keepWithNext giữ hàng cuối cùng trang với đoạn kế tiếp (dòng nguồn).
 * fixed (chế độ report): bố cục cố định + canh giữa + ngắt mềm chuỗi dài. Không có nó Word tự nới cột theo từ dài nhất
 * (autofit) làm bảng tràn lề phải, trông lệch một bên; LibreOffice giữ đúng độ rộng nên bản PDF không lộ lỗi.
 */
function table(headers, rows, widthsCm, { keepWithNext = false, centerHeader = false, keepHeadWithBody = false, fixed = false } = {}) {
  const total = widthsCm.reduce((a, b) => a + b, 0);
  const widths = widthsCm.map((w) => Math.round(w * CM));
  const cell = (text, isHeader, w, keepNext = false) => new TableCell({ // keepNext: giữ hàng này cùng trang với hàng/đoạn kế
    width: { size: w, type: WidthType.DXA },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: runs(fixed ? softBreak(text) : text, { ...(isHeader ? { bold: true } : {}), size: 24, short: true }), alignment: isHeader && centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 252, lineRule: LineRuleType.AUTO, after: 0 }, ...(keepNext ? { keepNext: true } : {}) })],
    verticalAlign: 'center',
  });
  return new Table({
    width: { size: Math.round(total * CM), type: WidthType.DXA },
    columnWidths: widths,
    ...(fixed ? { layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER } : {}),
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, true, widths[i], keepHeadWithBody)) }),
      ...rows.map((r, k) => new TableRow({ children: r.map((c, i) => cell(c, false, widths[i], (keepWithNext && k === rows.length - 1) || (keepHeadWithBody && k === 0 && rows.length > 1))) })),
    ],
  });
}

/**
 * Chuyển Markdown đơn giản (#, ##, ###, ####, đoạn, - danh sách, 1. danh sách, | bảng, > trích) thành phần tử docx.
 * Quy ước thêm cho quyển báo cáo (chế độ 'report'):
 * - `![Hình 3.1. Tên](hinh/x.png)` → hình + chú thích dưới hình; thêm `{ngang}` cuối dòng để đặt hình trên trang ngang.
 * - Dòng "Nguồn: …" ngay sau hình hoặc ngay sau bảng → dòng nguồn nghiêng 12 pt, canh giữa.
 * - `$$ công thức $$ (3.1)` → công thức canh giữa, số ở lề phải.
 * - Độ rộng cột: `tableWidths['Bảng 3.2']` (theo chú thích "Bảng 3.2. …" ngay trên bảng) hoặc `tableWidths[thứ tự bảng]`.
 * - `pageBreakBefore`: hàm (text, level) → true để tiêu đề đó sang trang mới (ví dụ từng phụ lục).
 * Hình ngang được trả về dưới dạng đối tượng `{ landscape: [phần tử…] }`; `buildDoc`/`buildDocSections` tách thành section ngang.
 */
function markdownToDocx(md, {
  skipFirstHeading = false, tableWidths = {}, shiftHeadings = true, mode = 'report', imageBase = null,
  pageBreakBefore = null, tableReport = null, headingExtra = null,
} = {}) {
  const lines = md.split('\n');
  const els = [];
  let i = 0; let firstHeadingSeen = false; let tableIdx = 0; let listInstance = 0; let inNumbered = false;
  let lastTableCaption = null;
  const T = mode === 'template';
  const body = (text, extra = {}) => para(text, T ? { indent: { firstLine: 720 }, line: 336, spacing: { before: 80, after: 0 }, ...extra } : { indent: { firstLine: 720 }, ...extra });
  const flushParagraph = (buf) => {
    if (!buf.length) return;
    const text = buf.join(' ');
    els.push(body(text));
  };
  /** Dòng "Nguồn: …" kế tiếp (bỏ qua dòng trống) — trả về [nội dung, chỉ số dòng sau nó] hoặc null. */
  const nextSource = (j) => {
    let k = j;
    while (k < lines.length && lines[k].trim() === '') k += 1;
    return k < lines.length && /^Nguồn:/.test(lines[k].trim()) ? [lines[k].trim(), k + 1] : null;
  };
  let buf = [];
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,4} /.test(line)) {
      flushParagraph(buf); buf = [];
      const level = line.match(/^(#{1,4}) /)[1].length;
      if (level === 1 && skipFirstHeading && !firstHeadingSeen) { firstHeadingSeen = true; i += 1; continue; }
      const text = line.replace(/^#{1,4} /, '');
      const lv = shiftHeadings ? Math.max(1, level - 1) : level;
      const extra = { ...(pageBreakBefore && pageBreakBefore(text, lv) ? { pageBreakBefore: true } : {}), ...(headingExtra ? headingExtra(text, lv) : {}) };
      els.push(heading(text, lv, mode, extra)); i += 1; continue;
    }
    const mImg = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*(\{ngang\})?(?:\{cao=([\d.,]+)\})?\s*$/);
    if (mImg) {                                   // ![Hình 4.1. Chú thích](hinh/xxx.png){ngang} hoặc …{cao=21} (cm)
      flushParagraph(buf); buf = [];
      const file = path.resolve(imageBase || process.cwd(), mImg[2]);
      const landscape = Boolean(mImg[3]);
      const src = T ? null : nextSource(i + 1);
      const fig = fs.existsSync(file)
        ? figure(file, mImg[1], { mode, source: src ? src[0] : null, landscape, maxHeightCm: mImg[4] ? Number(mImg[4].replace(',', '.')) : null })
        : [para(`[Thiếu hình: ${mImg[2]}]`, { run: { italics: true, color: '888888' }, align: AlignmentType.CENTER })];
      if (landscape) els.push({ landscape: fig }); else els.push(...fig);
      i = src ? src[1] : i + 1; continue;
    }
    if (/^```/.test(line)) {                       // khối mã (mermaid…): không in vào bản Word, chú thích hình viết ngay dưới khối
      flushParagraph(buf); buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) i += 1;
      i += 1; continue;
    }
    if (/^\|/.test(line)) {
      flushParagraph(buf); buf = [];
      const rowsRaw = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rowsRaw.push(lines[i]); i += 1; }
      const parse = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = parse(rowsRaw[0]);
      const body = rowsRaw.slice(2).map(parse);
      const given = (lastTableCaption && tableWidths[lastTableCaption]) || tableWidths[tableIdx];
      const fits = given && given.length === header.length;   // khai sai số cột → chia đều, báo qua tableReport
      const widths = fits ? given : Array(header.length).fill(15.5 / header.length);
      if (tableReport) tableReport.push({ idx: tableIdx, caption: lastTableCaption, cols: header.length, widths: given || widths, given: Boolean(given) });
      const src = T ? null : nextSource(i);
      els.push(table(header, body, widths, { keepWithNext: Boolean(src), centerHeader: !T, keepHeadWithBody: !T, fixed: !T }));
      if (src) { els.push(sourceLine(src[0])); i = src[1]; } else els.push(new Paragraph({ spacing: { after: T ? 60 : 120 } }));
      lastTableCaption = null;
      tableIdx += 1; continue;
    }
    if (/^\s*[-*] /.test(line)) { flushParagraph(buf); buf = []; els.push(para(line.replace(/^\s*[-*] /, ''), { numbering: { reference: 'bullets', level: (line.match(/^\s*/)[0].length >= 2 ? 1 : 0) }, ...(T ? { line: 336, spacing: { before: 40, after: 0 } } : {}) })); i += 1; continue; }
    if (/^\s*\d+\. /.test(line)) {
      flushParagraph(buf); buf = [];
      if (!inNumbered) { listInstance += 1; inNumbered = true; } // đánh số lại từ 1 cho mỗi danh sách
      els.push(para(line.replace(/^\s*\d+\. /, ''), { numbering: { reference: 'numbers', level: 0, instance: listInstance }, ...(T ? { line: 336, spacing: { before: 40, after: 0 } } : {}) })); i += 1; continue;
    }
    inNumbered = false;
    // Chú thích: "Hình 3.1. Tên" / "Bảng 3.2. Tên" (bản cũ: "Bảng 3.2 — Tên"). Đoạn văn mở đầu "Hình 3.1 cho thấy…" không phải chú thích.
    if (T ? /^(Hình|Bảng) \d/.test(line) : /^(Hình|Bảng) [0-9A-Z]+\.\d+(\.| —) /.test(line)) {
      flushParagraph(buf); buf = [];
      const mCap = line.match(/^Bảng ([0-9A-Z]+\.\d+)[.:\s]/);
      if (mCap) lastTableCaption = `Bảng ${mCap[1]}`;
      els.push(para(line.trim(), { run: { italics: true }, align: AlignmentType.CENTER, indent: undefined, ...(mCap && !T ? { keepNext: true } : {}), ...(T ? { line: 336, spacing: { before: 60, after: 120 } } : { spacing: { before: 60, after: 120 } }) }));
      i += 1; continue;
    }
    if (!T && /^Nguồn:/.test(line.trim())) { flushParagraph(buf); buf = []; els.push(sourceLine(line)); i += 1; continue; }
    const mF = !T && line.match(/^\$\$\s*(.+?)\s*\$\$\s*\((\d+\.\d+)\)\s*$/);
    if (mF) { flushParagraph(buf); buf = []; els.push(formula(mF[1], mF[2])); i += 1; continue; }
    if (/^> /.test(line)) { flushParagraph(buf); buf = []; els.push(para(line.replace(/^> /, ''), { run: { italics: true, color: '555555' }, indent: { left: 567 }, ...(T ? { line: 336, spacing: { before: 40, after: 0 } } : {}) })); i += 1; continue; }
    if (/^\[\d+\] /.test(line)) { flushParagraph(buf); buf = []; els.push(para(line.trim(), { run: {}, align: AlignmentType.LEFT, indent: { left: 720, hanging: 720 }, ...(T ? { line: 300, spacing: { before: 40, after: 0 } } : { spacing: { after: 60 } }) })); i += 1; continue; }
    if (/^---/.test(line)) { flushParagraph(buf); buf = []; i += 1; continue; }
    if (line.trim() === '') { flushParagraph(buf); buf = []; i += 1; continue; }
    buf.push(line.trim()); i += 1;
  }
  flushParagraph(buf);
  return els;
}

/** Style dùng chung: Heading 1–3 ghi đè style mặc định của docx-js (chỉ một bộ trong styles.xml), cộng TOC 1–3. */
function docStyles() {
  const h = (size, italics, before, after, outlineLevel) => ({
    run: { font: FONT, size, bold: true, ...(italics ? { italics: true } : {}) },
    paragraph: { spacing: { before, after, line: LINE, lineRule: LineRuleType.AUTO }, outlineLevel },
  });
  return {
    default: {
      document: { run: { font: FONT, size: SIZE }, paragraph: { spacing: { line: LINE, lineRule: LineRuleType.AUTO } } },
      heading1: h(28, false, 360, 120, 0),
      heading2: h(26, false, 240, 120, 1),
      heading3: h(26, true, 200, 100, 2),
    },
    paragraphStyles: [
      { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 } } },
      { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26 }, paragraph: { indent: { left: 440 }, spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 } } },
      { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26 }, paragraph: { indent: { left: 880 }, spacing: { line: 300, lineRule: LineRuleType.AUTO, after: 40 } } },
    ],
  };
}

const NUMBERING = {
  config: [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '+', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
    ] },
    { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ],
};

const A4 = { width: 11906, height: 16838 };
/** Lề trang ngang chèn giữa thân bài: cạnh trên là cạnh gáy khi đóng quyển (3,5 cm), dưới 2,0, trái/phải 2,5 cm. */
const LANDSCAPE_MARGIN = { top: Math.round(3.5 * CM), bottom: Math.round(2.0 * CM), left: Math.round(2.5 * CM), right: Math.round(2.5 * CM) };
const pageFooter = (fmt) => new Footer({ children: [fmt
  ? new Paragraph({ children: [new TextRun({ children: ['Trang ', PageNumber.CURRENT], font: FONT, size: 22 })], alignment: AlignmentType.CENTER })
  : new Paragraph({})] });

/** Tách danh sách phần tử thành các đoạn dọc/ngang theo đối tượng { landscape: [...] } của markdownToDocx. */
function splitLandscape(children) {
  const parts = []; let cur = [];
  for (const c of children) {
    if (c && Array.isArray(c.landscape)) {
      if (cur.length) parts.push({ landscape: false, children: cur });
      const prev = parts[parts.length - 1];
      // Hình ngang liền nhau (không có đoạn dọc chen giữa) dùng chung một section ngang, mỗi hình một trang.
      if (!cur.length && prev && prev.landscape) prev.children.push(...c.landscape);
      else parts.push({ landscape: true, children: [...c.landscape] });
      cur = [];
    } else cur.push(c);
  }
  if (cur.length || !parts.length) parts.push({ landscape: false, children: cur });
  return parts;
}

function buildDoc(children, { title, headerText, margin }) {
  const mg = margin || { top: 2.5 * CM, bottom: 2.5 * CM, left: 3.5 * CM, right: 2 * CM };
  const headers = {
    first: new Header({ children: [new Paragraph({})] }),
    default: new Header({ children: [headerText ? new Paragraph({ children: [new TextRun({ text: headerText, font: FONT, size: 20, italics: true, color: '666666' })], alignment: AlignmentType.RIGHT }) : new Paragraph({})] }),
  };
  const footers = {
    first: new Footer({ children: [new Paragraph({})] }),
    default: new Footer({ children: [new Paragraph({ children: [new TextRun({ children: ['Trang ', PageNumber.CURRENT], font: FONT, size: 22 })], alignment: AlignmentType.CENTER })] }),
  };
  // Có hình {ngang} → mỗi hình ngang một section riêng, số trang chạy tiếp; không có thì giữ đúng một section như trước.
  const parts = splitLandscape(children);
  const sections = parts.map((p, k) => ({
    properties: p.landscape
      ? { page: { size: { ...A4, orientation: PageOrientation.LANDSCAPE }, margin: LANDSCAPE_MARGIN } }
      : { page: { size: A4, margin: mg }, ...(k === 0 ? { titlePage: true } : {}) },
    headers: k === 0 ? headers : { default: headers.default },
    footers: k === 0 ? footers : { default: footers.default },
    children: p.children,
  }));
  return new Document({
    creator: 'Nhóm SmartTask', title,
    features: { updateFields: true },
    styles: docStyles(),
    numbering: NUMBERING,
    sections,
  });
}

/**
 * Quyển nhiều section. Mỗi phần tử của `parts`: { children, footer: null | 'roman' | 'decimal', restart: số | undefined,
 * margin, fullBleed (ảnh tràn trang, lề 0) }. Phần có footer 'decimal' được tự tách thêm section ngang cho hình {ngang}.
 * Dùng `finalizeDocx` sau Packer.toBuffer để gắn sectPr vào đoạn cuối mỗi section và dựng trường TOC.
 */
function buildDocSections(parts, { title, margin }) {
  const mg = margin || { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round(3.5 * CM), right: Math.round(2 * CM) };
  const sections = [];
  for (const p of parts) {
    const fmt = p.footer === 'roman' ? NumberFormat.LOWER_ROMAN : p.footer === 'decimal' ? NumberFormat.DECIMAL : null;
    const chunks = p.footer === 'decimal' ? splitLandscape(p.children) : [{ landscape: false, children: p.children }];
    chunks.forEach((c, k) => {
      const pageNumbers = fmt ? { formatType: fmt, ...(k === 0 && p.restart ? { start: p.restart } : {}) } : undefined;
      const page = c.landscape
        ? { size: { ...A4, orientation: PageOrientation.LANDSCAPE }, margin: LANDSCAPE_MARGIN }
        : p.fullBleed
          ? { size: A4, margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 } }
          : { size: A4, margin: mg };
      sections.push({
        properties: { page: { ...page, ...(pageNumbers ? { pageNumbers } : {}) } },
        headers: { default: new Header({ children: [new Paragraph({})] }) },
        footers: { default: pageFooter(fmt) },
        children: c.children,
      });
    });
  }
  return new Document({
    creator: 'Nhóm SmartTask', title,
    features: { updateFields: true },
    styles: docStyles(),
    numbering: NUMBERING,
    sections,
  });
}

const TOC_BEGIN = '§§TOC_BEGIN§§';
const TOC_END = '§§TOC_END§§';

/**
 * Mục lục là trường TOC thật (\o "1-3" \h \z \u). Nội dung dựng sẵn bên trong trường là các dòng mục lục kèm số trang
 * in trên trang (lượt hai đọc từ PDF thử), nên LibreOffice hiện đúng ngay; Word bấm F9 sẽ dựng lại theo Heading 1–3.
 */
function tocField(entries, { title = 'MỤC LỤC' } = {}) {
  const line = (e, k) => new Paragraph({
    style: `TOC${e.level}`,
    tabStops: [{ type: TabStopType.RIGHT, position: Math.round(15.5 * CM), leader: 'dot' }],
    children: [
      ...(k === 0 ? [new TextRun({ text: TOC_BEGIN })] : []),
      new TextRun({ text: e.text, font: FONT, size: 26, bold: e.level === 1 }),
      new TextRun({ text: `\t${e.page}`, font: FONT, size: 26, bold: e.level === 1 }),
      ...(k === entries.length - 1 ? [new TextRun({ text: TOC_END })] : []),
    ],
  });
  return [
    new Paragraph({ pageBreakBefore: true, children: runs(title, { bold: true, size: 28 }), alignment: AlignmentType.CENTER, spacing: { before: 360, after: 360, line: LINE, lineRule: LineRuleType.AUTO } }),
    ...entries.map(line),
  ];
}

/**
 * Hậu xử lý document.xml: (1) thay hai mốc TOC bằng fldChar begin/instrText/separate … end;
 * (2) gắn sectPr của mỗi section vào đoạn cuối của section đó (docx-js tạo thêm một đoạn rỗng chỉ chứa sectPr —
 * đoạn này tràn sang trang mới sau ảnh tràn trang hoặc trang đã đầy).
 */
async function finalizeDocx(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  let xml = await zip.file('word/document.xml').async('string');
  const runWith = (marker) => new RegExp(`<w:r>(?:<w:rPr>(?:(?!</w:r>).)*?</w:rPr>)?<w:t[^>]*>${marker}</w:t></w:r>`);
  const fld = (type) => `<w:r><w:fldChar w:fldCharType="${type}"/></w:r>`;
  xml = xml.replace(runWith(TOC_BEGIN), `${fld('begin')}<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>${fld('separate')}`);
  xml = xml.replace(runWith(TOC_END), fld('end'));
  const sectPara = /<w:p><w:pPr>(<w:sectPr(?:(?!<\/w:sectPr>).)*<\/w:sectPr>)<\/w:pPr><\/w:p>/g;
  let out = ''; let last = 0; let m;
  while ((m = sectPara.exec(xml))) {
    let before = xml.slice(last, m.index);
    const full = out + before;
    if (full.endsWith('</w:p>')) {
      const pStart = Math.max(full.lastIndexOf('<w:p>'), full.lastIndexOf('<w:p '));
      let p = full.slice(pStart);
      const openEnd = p.indexOf('>') + 1;
      if (p.slice(openEnd).startsWith('<w:pPr>')) {
        const close = p.indexOf('</w:pPr>');
        p = p.slice(0, close) + m[1] + p.slice(close);
      } else {
        p = `${p.slice(0, openEnd)}<w:pPr>${m[1]}</w:pPr>${p.slice(openEnd)}`;
      }
      out = full.slice(0, pStart) + p;
    } else {
      out = full + m[0];                          // sau bảng: giữ đoạn chứa sectPr như docx-js
    }
    last = m.index + m[0].length;
  }
  xml = out + xml.slice(last);
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
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
function coverPage({ studentLines, titleLines, subtitle, info, placeDate, docType = null, titleSize = 56, subtitleSize = 30, titleLine = 360, gapAfterInfo = 700 }) {
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
    ...(docType ? [c(runs(docType, { bold: true, size: 32 }), 200, { line: titleLine })] : []),
    ...titleLines.map((t) => c(runs(t, { bold: true, size: titleSize }), 0, { line: titleLine })),
    ...(subtitle ? [new Paragraph({ spacing: { after: 120 } }), ...subtitle.map((t) => c(runs(t, { bold: true, size: subtitleSize }), 0, { line: titleLine }))] : []),
    new Paragraph({ spacing: { after: 360 } }),
    infoTable,
    new Paragraph({ spacing: { after: gapAfterInfo } }),
    c(runs(placeDate, { bold: true, italics: true }), 0),
  ];
}

/**
 * Trang bìa theo mẫu Khoa `Mau_DeCuong.docx`: 3 dòng đầu trang 16pt đậm → gạch ngắn → logo SGU (5,8 × 4,4 cm)
 * → "Đề cương tiểu luận học phần Đồ án chuyên ngành" 16pt → TÊN ĐỒ ÁN 20pt → NHÓM 14pt → Sinh viên / GVHD 14pt → nơi, năm 12pt.
 */
function coverDeCuong({ titleLines, group, students, gvhd, year, docLine = 'Đề cương tiểu luận học phần Đồ án chuyên ngành', placeLine = null, pageBreak = true, gapBeforePlace = 2100, topGap = 0 }) {
  const logo = fs.readFileSync(path.join(__dirname, 'assets', 'sgu-logo-decuong.png'));
  const c = (children, opts = {}) => new Paragraph({ children, alignment: opts.align || AlignmentType.CENTER, spacing: { before: opts.before || 0, after: opts.after || 0, line: opts.line || 240, lineRule: LineRuleType.AUTO }, ...(opts.indent ? { indent: opts.indent } : {}), ...(opts.tabStops ? { tabStops: opts.tabStops } : {}) });
  const head = (t, before = 0) => c(runs(t, { bold: true, size: 32 }), { before });
  const labelLine = (label, value) => new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: Math.round(5.6 * CM) }, { type: TabStopType.LEFT, position: Math.round(6.0 * CM) }],
    spacing: { before: 0, after: 0, line: 360, lineRule: LineRuleType.AUTO },
    children: [new TextRun({ text: `\t${label}\t`, bold: true, font: FONT, size: 28 }), ...runs(value, { bold: true, size: 28 })],
  });
  return [
    head('ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH', topGap),
    head('TRƯỜNG ĐẠI HỌC SÀI GÒN'),
    head('KHOA CÔNG NGHỆ THÔNG TIN'),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, indent: { left: 3200, right: 3200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } } }),
    new Paragraph({ children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 174, height: 130 } })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 480, line: 240, lineRule: LineRuleType.AUTO } }),
    c(runs(docLine, { bold: true, size: 32 }), { after: 300 }),
    ...titleLines.map((t) => c(runs(t, { bold: true, size: 36 }), { line: 300 })),
    c(runs(group, { bold: true, size: 28 }), { before: 300, after: 200 }),
    labelLine('Sinh viên:', students[0]),
    ...students.slice(1).map((n) => labelLine('', n)),
    labelLine('GVHD:', gvhd),
    new Paragraph({ spacing: { after: gapBeforePlace } }),
    c(runs(placeLine || `Thành phố Hồ Chí Minh, năm ${year}`, { bold: true, size: 24 })),
    ...(pageBreak ? [new Paragraph({ children: [new PageBreak()] })] : []),
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

/** Thu thập mục lục từ Markdown: (#, ##, ###) sau tiêu đề đầu tiên; maxLevel 3 lấy thêm cấp ####. */
function tocEntriesFromMarkdown(md, { maxLevel = 2 } = {}) {
  const out = [];
  let first = true;
  const re = maxLevel >= 3 ? /^(#{1,4}) (.+)$/ : /^(#{1,3}) (.+)$/;
  for (const line of md.split('\n')) {
    const m = line.match(re);
    if (!m) continue;
    if (m[1].length === 1 && first) { first = false; continue; }
    const text = m[2].replace(/\*\*/g, '').replace(/`/g, '');
    const level = Math.max(1, m[1].length - 1);
    out.push({ level, text: level === 1 ? text.toUpperCase() : text, page: '?' });
  }
  return out;
}

module.exports = {
  figure, pngSize, signatureTable, letterhead, coverPage, coverDeCuong, tocStatic, tocEntriesFromMarkdown, Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, CM, FONT, SIZE, runs, para, heading, table, markdownToDocx, buildDoc, PLACEHOLDERS,
  sourceLine, formula, buildDocSections, finalizeDocx, tocField, PX_PER_CM,
};
