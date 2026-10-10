// Dựng quyển báo cáo đồ án chuyên ngành từ docs/06-bao-cao/bao-cao-tieu-luan.md.
// Chạy: node scripts/docx/build-bao-cao.js Draft-N  → docs/06-bao-cao/nop/Bao-cao-tieu-luan-Draft-N.docx (+ .pdf)
// Nhãn là bắt buộc; Draft-1, Draft-2 đã nộp nên bị từ chối để không ghi đè.
//
// Thứ tự 11 phần theo PDF Khoa tr. 6, mỗi phần một section:
//   bìa chính → trang trắng (chỗ biên bản chấm) → đề cương đã duyệt (14 trang ảnh, lề 0) → lời cam đoan, lời cảm ơn,
//   mục lục (trường TOC), danh mục chữ viết tắt, danh mục bảng, danh mục hình (số La Mã i, ii, …) → bìa phụ
//   → Chương 1–7, tài liệu tham khảo, phụ lục (số Ả Rập từ 1; hình {ngang} nằm trong section trang ngang, số chạy tiếp).
// Bìa, trang trắng, đề cương, bìa phụ không in số trang. Footer "Trang N" canh giữa, Times New Roman 11.
// Số trang của mục lục và hai danh mục là số IN trên trang ("Trang xx" ở chân trang), đọc từ bản PDF dựng thử.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { TabStopType, LineRuleType, ImageRun } = require('docx');
const {
  Packer, Paragraph, AlignmentType, CM, runs, heading,
  markdownToDocx, coverDeCuong, tocEntriesFromMarkdown, tocField, buildDocSections, finalizeDocx,
} = require('./lib');

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'docs/06-bao-cao/bao-cao-tieu-luan.md');
const OUT = process.env.BAO_CAO_OUT || path.join(REPO, 'docs/06-bao-cao/nop'); // BAO_CAO_OUT: dựng thử ra thư mục khác
const DE_CUONG = path.join(REPO, 'docs/06-bao-cao/de-cuong-da-duyet');
const LABEL = process.argv[2];
if (!LABEL || !/^Draft-\d+$/.test(LABEL)) { console.error('Cần nhãn bản dựng, ví dụ: node scripts/docx/build-bao-cao.js Draft-3'); process.exit(1); }
if (['Draft-1', 'Draft-2'].includes(LABEL)) { console.error(`${LABEL} đã nộp — không dựng đè.`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const STUDENTS = [
  'Nguyễn Duy Thái - 3122410380',
  'Lê Mạnh Cường - 3123410039',
  'Nguyễn Âu Gia Bảo - 3123410025',
  'Nguyễn Khả Minh - 3123410219',
  'Trần Thanh Huy - 3121560039',
];

// Độ rộng cột (cm, tổng ≤ 15,5) theo chú thích "Bảng x.y." ngay trên bảng. Bảng không có ở đây chia đều và bị báo khi dựng.
const TABLE_WIDTHS = {
  'Bảng 2.1': [5.6, 2.0, 2.0, 2.0, 1.9, 2.0],    // so sánh sản phẩm
  'Bảng 3.1': [3.2, 7.2, 5.1],                   // nội dung phỏng vấn
  'Bảng 3.2': [3.6, 5.8, 6.1],                   // quy chuẩn nghiệp vụ
  'Bảng 3.3': [1.3, 3.6, 5.4, 5.2],              // nút thắt
  'Bảng 3.4': [4.2, 5.4, 5.9],                   // giả định lý tưởng hoá
  'Bảng 3.5': [3.0, 5.3, 7.2],                   // hiện tại – mong muốn
  'Bảng 3.6': [2.6, 4.2, 8.7],                   // ma trận phân quyền
  'Bảng 3.7': [2.3, 3.5, 9.7],                   // tác nhân hệ thống
  'Bảng 3.8': [1.2, 3.8, 6.6, 3.9],              // sáu phân hệ
  ...Object.fromEntries([9, 10, 11, 12, 13, 14].map((k) => [`Bảng 3.${k}`, [1.6, 4.0, 7.1, 2.8]])), // đặc tả phân hệ
  'Bảng 3.15': [4.4, 2.6, 8.5],                  // phân làn
  'Bảng 3.16': [3.3, 5.4, 6.8],                  // trạng thái nghiệp vụ
  'Bảng 3.17': [3.0, 2.2, 6.8, 3.5],             // ngoại lệ AI
  'Bảng 3.18': [2.7, 4.6, 8.2],                  // tham số tính tải
  'Bảng 3.19': [3.0, 4.4, 3.0, 5.1],             // phương án quá tải
  'Bảng 3.20': [1.5, 7.9, 1.6, 2.8, 1.7],        // yêu cầu chức năng
  'Bảng 3.21': [1.7, 2.4, 3.0, 5.4, 3.0],        // yêu cầu phi chức năng
  'Bảng 4.1': [2.4, 3.8, 3.0, 6.3],              // quyết định công nghệ
  'Bảng 4.2': [3.0, 6.2, 6.3],                   // nhóm bảng dữ liệu
  'Bảng 4.3': [3.8, 4.0, 7.7],                   // phi chuẩn hoá có chủ đích
  'Bảng 4.4': [4.6, 6.0, 4.9],                   // snapshot và lưu vết
  'Bảng 4.5': [4.0, 5.3, 6.2],                   // chỉ mục duy nhất một phần
  'Bảng 4.6': [3.4, 6.6, 5.5],                   // CHECK, EXCLUDE
  'Bảng 4.7': [3.4, 12.1],                       // quy ước API
  'Bảng 4.8': [2.6, 6.4, 6.5],                   // thành phần sơ đồ tuần tự theo tầng
  'Bảng 6.1': [5.9, 3.4, 6.2],                   // đối chiếu luồng → hình ở Chương 5
  'Bảng 6.2': [3.6, 7.2, 4.7],                   // chỉ số thực nghiệm
  'Bảng A.1': [2.8, 1.5, 4.6, 3.0, 2.0, 1.6],    // phân hệ → use case
  'Bảng B.1': [2.4, 2.1, 5.4, 5.6],              // điểm cuối API (sinh từ OpenAPI); cột phương thức đủ cho "DELETE"
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((k) => [`Bảng C.${k}`, [3.6, 4.4, 3.4, 4.1]])), // từ điển dữ liệu
};

/** Danh mục bảng / hình: tiêu đề là Heading 1 (để trường TOC của Word nhận), mỗi dòng có dấu chấm dẫn tới số trang. */
function listPage(title, entries) {
  const line = (e) => new Paragraph({
    spacing: { line: 276, lineRule: LineRuleType.AUTO, after: 30 },
    indent: { left: 1080, hanging: 1080 },
    tabStops: [{ type: TabStopType.RIGHT, position: Math.round(15.5 * CM), leader: 'dot' }],
    children: [...runs(e.text), ...runs(`\t${e.page}`)],
  });
  return [heading(title, 1), ...entries.map(line)];
}

/** Mười bốn trang đề cương đã duyệt: mỗi trang một ảnh A4 (lề 0); số "Trang N" in sẵn trong ảnh là của đề cương. */
function deCuongPages() {
  const files = fs.readdirSync(DE_CUONG).filter((f) => /^de-cuong-trang-\d+\.png$/.test(f)).sort();
  if (files.length !== 14) console.log(`CẢNH BÁO: đề cương có ${files.length} trang ảnh (cần 14).`);
  return files.map((f) => new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(DE_CUONG, f)), transformation: { width: 791, height: 1118 } })],
  }));
}

(async () => {
  let md = fs.readFileSync(SRC, 'utf8');
  md = md.slice(md.indexOf('## LỜI CAM ĐOAN')); // bỏ tiêu đề và ghi chú nội bộ; bìa đã có tên đề tài

  const iAbbr = md.indexOf('## DANH MỤC CHỮ VIẾT TẮT');
  const iBody = md.indexOf('## CHƯƠNG 1');
  const mdLoi = md.slice(0, iAbbr);              // lời cam đoan, lời cảm ơn
  const mdAbbr = md.slice(iAbbr, iBody);         // danh mục chữ viết tắt
  const mdBody = md.slice(iBody);                // bảy chương → tài liệu tham khảo → phụ lục

  const tableReport = [];
  const opts = (tableWidths) => ({
    skipFirstHeading: false, shiftHeadings: true, mode: 'report',
    tableWidths, imageBase: path.join(REPO, 'docs/06-bao-cao'), tableReport,
    // Mỗi phụ lục sang trang mới; Phụ lục A đứng ngay sau tiêu đề PHỤ LỤC (đã sang trang).
    pageBreakBefore: (text, level) => level === 2 && /^Phụ lục [B-Z]\b/.test(text),
    headingExtra: (text, level) => (level === 2 && /^Phụ lục [A-Z]\b/.test(text) ? { center: true } : {}), // tiêu đề phụ lục canh giữa như tiêu đề chương
  });
  const loi = markdownToDocx(mdLoi, opts({}));
  const abbr = markdownToDocx(mdAbbr, opts({ 0: [3.6, 11.9] }));
  tableReport.length = 0;                        // chỉ báo các bảng có số
  const body = markdownToDocx(mdBody, opts(TABLE_WIDTHS));

  // Bìa chính và bìa phụ theo đúng khuôn bìa đề cương đã duyệt (mẫu Mau_DeCuong.docx của Khoa): 3 dòng đầu trang 16 pt,
  // gạch ngắn, logo SGU 5,8 × 4,4 cm, dòng loại tài liệu 16 pt, tên đề tài 18 pt, NHÓM 14 pt, Sinh viên/GVHD 14 pt, nơi – thời gian 12 pt.
  const now = new Date();
  const coverArgs = {
    docLine: 'BÁO CÁO ĐỒ ÁN CHUYÊN NGÀNH',
    titleLines: ['XÂY DỰNG NỀN TẢNG QUẢN TRỊ DỰ ÁN THÔNG MINH VÀ CÂN BẰNG TẢI NHÂN SỰ TÍCH HỢP AI AGENT'],
    group: 'NHÓM 02',
    students: STUDENTS,
    gvhd: 'ThS. Trần Đình Nghĩa',
    placeLine: `Thành phố Hồ Chí Minh, tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`,
    pageBreak: false,
    gapBeforePlace: 2100,
    topGap: 310,                                  // bù lề trên 2,5 cm của quyển so với 2,3 cm của đề cương
  };


  // Mục lục: các tiêu đề cấp 1–3 của Markdown, chèn thêm hai danh mục (không có trong Markdown) sau danh mục chữ viết tắt.
  const tocEntries = tocEntriesFromMarkdown(md, { maxLevel: 3 });
  const iAfterAbbr = tocEntries.findIndex((e) => e.text === 'DANH MỤC CHỮ VIẾT TẮT') + 1;
  tocEntries.splice(iAfterAbbr, 0, { level: 1, text: 'DANH MỤC BẢNG' }, { level: 1, text: 'DANH MỤC HÌNH' });
  // Lượt một dùng số trang giả '0' để trang mục lục vẫn có dấu chấm dẫn — nhờ đó lượt hai nhận ra đây là trang danh mục.
  tocEntries.forEach((e) => { e.page = '0'; });
  const figEntries = [...md.matchAll(/^!\[([^\]]+)\]\([^)]+\)/gm)].map((m) => ({ text: m[1], page: '0' }));
  const tblEntries = [...md.matchAll(/^(Bảng [0-9A-Z]+\.\d+(?:\.| —) .+)$/gm)].map((m) => ({ text: m[1].trim(), page: '0' }));

  const assemble = () => buildDocSections([
    { children: coverDeCuong(coverArgs), footer: null },                    // 1. bìa chính
    { children: [new Paragraph({})], footer: null },                         // 2. trang trắng: biên bản chấm (chèn sau)
    { children: deCuongPages(), footer: null, fullBleed: true },             // 3. đề cương đã duyệt
    { children: [                                                           // 4–7. phần đầu, số La Mã
      ...loi,
      ...tocField(tocEntries),
      ...abbr,
      ...listPage('DANH MỤC BẢNG', tblEntries),
      ...listPage('DANH MỤC HÌNH', figEntries),
    ], footer: 'roman', restart: 1 },
    { children: coverDeCuong(coverArgs), footer: null },                    // 8. bìa phụ
    { children: body, footer: 'decimal', restart: 1 },                       // 9–11. nội dung, TLTK, phụ lục
  ], { title: `Báo cáo đồ án chuyên ngành — SmartTask (${LABEL.replace('-', ' ')})` });
  const write = async (file) => fs.writeFileSync(file, await finalizeDocx(await Packer.toBuffer(assemble())));

  const out = path.join(OUT, `Bao-cao-tieu-luan-${LABEL}.docx`);
  const outPdf = out.replace(/\.docx$/, '.pdf');
  await write(out);

  // Đọc PDF: chữ từng trang và số trang in ở chân trang ("Trang xx", kể cả số La Mã).
  const readPdf = (pdf) => {
    const pages = Number(execSync(`pdfinfo "${pdf}" | awk '/^Pages/{print $2}'`).toString().trim());
    const texts = [];
    for (let i = 1; i <= pages; i += 1) texts.push(execSync(`pdftotext -layout -f ${i} -l ${i} "${pdf}" -`).toString().replace(/[ \t]+/g, ' '));
    const lines = texts.map((t) => t.split('\n').map((l) => l.trim()).filter(Boolean));
    const printed = lines.map((ls) => { const m = (ls[ls.length - 1] || '').match(/^Trang ([0-9]+|[ivxlcdm]+)$/); return m ? m[1] : null; });
    return { texts, lines, printed };
  };
  const toPdf = (docx, dir) => {
    execSync(`soffice --headless --convert-to pdf --outdir "${dir}" "${docx}"`, { stdio: 'ignore', timeout: 300000 });
    return path.join(dir, path.basename(docx).replace(/\.docx$/, '.pdf'));
  };
  // Trang mục lục / danh mục nhận ra bằng số dòng có dấu chấm dẫn tới số trang (kể cả trang tràn).
  const isIndexPage = (t) => (t.match(/\.{6,} ?([0-9]+|[ivxlcdm]+)\s*$/gm) || []).length >= 3;
  /** Trang của từng mục: khớp nguyên dòng ở bất kỳ trang nào, hoặc khớp đầu dòng ở trang không phải danh mục; tìm theo thứ tự. */
  const locate = (entries, { lines, texts, printed }) => {
    let from = 0;
    return entries.map((e) => {
      const key = e.text.replace(/[ \t]+/g, ' ').replace(/\*/g, '').trim();
      const head = key.slice(0, 45);
      let idx = lines.findIndex((ls, i) => i >= from && ls.includes(key));
      if (idx < 0) idx = lines.findIndex((ls, i) => i >= from && !isIndexPage(texts[i]) && ls.some((l) => l.startsWith(head) && l.length <= key.length + 15));
      if (idx >= 0) from = idx;
      return idx >= 0 ? printed[idx] || '' : '';
    });
  };

  // Lượt hai: điền số trang in thật vào mục lục và các danh mục, dựng lại.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toc-'));
  let pdf = readPdf(toPdf(out, tmp));
  [tocEntries, figEntries, tblEntries].forEach((list) => locate(list, pdf).forEach((p, k) => { list[k].page = p; }));
  await write(out);

  // Lượt ba: PDF bản cuối đặt cạnh .docx; kiểm lại số trang của từng mục.
  pdf = readPdf(toPdf(out, OUT));
  const check = (name, list) => {
    const got = locate(list, pdf);
    const bad = list.filter((e, k) => !e.page || e.page !== got[k]);
    console.log(`${name}: ${list.length - bad.length}/${list.length} mục khớp số trang in`);
    bad.slice(0, 10).forEach((e) => console.log(`  lệch: "${e.text}" ghi ${e.page || '(trống)'}`));
  };
  check('Mục lục', tocEntries); check('Danh mục bảng', tblEntries); check('Danh mục hình', figEntries);
  const missing = tableReport.filter((t) => !t.given);
  if (missing.length) console.log('Bảng chưa khai báo độ rộng:', missing.map((t) => t.caption || `#${t.idx}`).join(', '));
  tableReport.filter((t) => t.widths.length !== t.cols).forEach((t) => console.log(`CẢNH BÁO: ${t.caption} có ${t.cols} cột nhưng khai ${t.widths.length} độ rộng`));
  tableReport.filter((t) => t.widths.reduce((a, b) => a + b, 0) > 15.51).forEach((t) => console.log(`CẢNH BÁO: ${t.caption} rộng hơn 15,5 cm`));
  console.log('Đã tạo:', path.relative(REPO, out), '·', path.relative(REPO, outPdf), `— ${pdf.texts.length} trang, ${figEntries.length} hình, ${tblEntries.length} bảng`);
})();
