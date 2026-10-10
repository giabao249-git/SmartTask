// Dựng "Đề cương tiểu luận" theo mẫu Khoa (Mau_DeCuong.docx) từ docs/01-de-cuong/de-cuong-chi-tiet.md.
// Chạy: node scripts/docx/build-de-cuong.js  → docs/01-de-cuong/nop/tuan-03/De-cuong-chi-tiet-Draft-5.docx
// Bìa giữ đúng bản nhóm sửa tay Tuần 02 (NHÓM 02, mỗi dòng 'Họ tên - MSSV').
const fs = require('fs');
const path = require('path');
const { Packer, Paragraph, AlignmentType, CM, runs, markdownToDocx, buildDoc, coverDeCuong } = require('./lib');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'docs/01-de-cuong/nop/tuan-03');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let md = fs.readFileSync(path.join(REPO, 'docs/01-de-cuong/de-cuong-chi-tiet-v5.md'), 'utf8');
  // Tên đề tài, GVHD, nhóm đã nằm trên bìa → thân bắt đầu từ Mục 1 (bỏ ghi chú phiên bản/nội bộ)
  md = md.slice(md.indexOf('## 1.'));
  const tableWidths = { 0: [4.0, 1.9, 2.4, 2.4, 2.4, 2.9], 1: [1.6, 2.9, 7.0, 4.0] };
  const body = markdownToDocx(md, { skipFirstHeading: false, shiftHeadings: true, mode: 'template', tableWidths });
  const children = [
    ...coverDeCuong({
      titleLines: ['XÂY DỰNG NỀN TẢNG QUẢN TRỊ DỰ ÁN THÔNG MINH VÀ CÂN BẰNG TẢI NHÂN SỰ TÍCH HỢP AI AGENT'],
      group: 'NHÓM 02',
      students: [
        'Nguyễn Duy Thái - 3122410380',
        'Lê Mạnh Cường - 3123410039',
        'Nguyễn Âu Gia Bảo - 3123410025',
        'Nguyễn Khả Minh - 3123410219',
        'Trần Thanh Huy - 3121560039',
      ],
      gvhd: 'ThS. Trần Đình Nghĩa',
      year: 2026,
    }),
    new Paragraph({ children: runs('ĐỀ CƯƠNG TIỂU LUẬN', { bold: true, size: 32 }), alignment: AlignmentType.CENTER, spacing: { after: 240, line: 240 } }),
    ...body,
  ];
  const doc = buildDoc(children, {
    title: 'Đề cương tiểu luận — SmartTask (Draft 5)', headerText: '',
    margin: { top: 1303, bottom: 1303, left: 1700, right: 850 }, // như file mẫu: 2,3 / 2,3 / 3,0 / 1,5 cm
  });
  const out = path.join(OUT, 'De-cuong-chi-tiet-Draft-5.docx');
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log('Đã tạo:', path.relative(REPO, out));
})();
