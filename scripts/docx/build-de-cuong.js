// Dựng "Đề cương tiểu luận" theo mẫu Khoa (Mau_DeCuong.docx) từ docs/01-de-cuong/de-cuong-chi-tiet.md.
// Chạy: node scripts/docx/build-de-cuong.js  → docs/01-de-cuong/nop/tuan-02/De-cuong-chi-tiet-Draft-2.docx
const fs = require('fs');
const path = require('path');
const { Packer, Paragraph, AlignmentType, CM, runs, markdownToDocx, buildDoc, coverDeCuong } = require('./lib');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'docs/01-de-cuong/nop/tuan-02');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let md = fs.readFileSync(path.join(REPO, 'docs/01-de-cuong/de-cuong-chi-tiet.md'), 'utf8');
  // Tên đề tài, GVHD, nhóm đã nằm trên bìa → thân bắt đầu từ Mục 1 (bỏ ghi chú phiên bản/nội bộ)
  md = md.slice(md.indexOf('## 1.'));
  const tableWidths = { 0: [4.0, 1.9, 2.4, 2.4, 2.4, 2.9], 1: [1.6, 2.8, 6.2, 3.3, 2.3] };
  const body = markdownToDocx(md, { skipFirstHeading: false, shiftHeadings: true, mode: 'template', tableWidths });
  const children = [
    ...coverDeCuong({
      titleLines: ['XÂY DỰNG NỀN TẢNG QUẢN TRỊ DỰ ÁN THÔNG MINH VÀ CÂN BẰNG TẢI NHÂN SỰ TÍCH HỢP AI AGENT', '(SMARTTASK)'],
      group: 'NHÓM «..»',
      students: ['«TV1» (nhóm trưởng)', '«TV2»', '«TV3»', '«TV4»', '«TV5»'],
      gvhd: 'ThS. Trần Đình Nghĩa',
      year: 2026,
    }),
    new Paragraph({ children: runs('ĐỀ CƯƠNG TIỂU LUẬN', { bold: true, size: 32 }), alignment: AlignmentType.CENTER, spacing: { after: 240, line: 240 } }),
    ...body,
  ];
  const doc = buildDoc(children, {
    title: 'Đề cương tiểu luận — SmartTask (Draft 2)', headerText: '',
    margin: { top: 1303, bottom: 1303, left: 1700, right: 850 }, // như file mẫu: 2,3 / 2,3 / 3,0 / 1,5 cm
  });
  const out = path.join(OUT, 'De-cuong-chi-tiet-Draft-2.docx');
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log('Đã tạo:', path.relative(REPO, out));
})();
