const fs = require('fs');
const path = require('path');
const { Packer, Paragraph, TextRun, AlignmentType, CM, FONT, SIZE, runs, para, heading, table, markdownToDocx, buildDoc, signatureTable, letterhead, coverPage, tocStatic, tocEntriesFromMarkdown } = require('./lib');
const { execSync } = require('child_process');
const os = require('os');

const REPO = require('path').resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'docs/01-de-cuong/nop/tuan-01');
fs.mkdirSync(OUT, { recursive: true });

const center = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 60, line: 312 } });
const blank = () => new Paragraph({ spacing: { after: 120 } });

const subhead = () => center('Học phần: Đồ án Chuyên ngành (841476) · GVHD: ThS. Trần Đình Nghĩa', { run: { italics: true, size: 24 }, after: 240 });

// ───────────────────────── 1. Biên bản phân công nhóm ─────────────────────────
(async () => {
  const roles = [
    ['«TV1»', 'Nhóm trưởng · PM & BA', 'Điều phối tiến độ, liên hệ GVHD, đề cương, đặc tả UC, quyển báo cáo, kịch bản demo', ''],
    ['«TV2»', 'Backend Lead', 'NestJS, Prisma, xác thực/phân quyền, API dự án–công việc, Swagger, ERD', ''],
    ['«TV3»', 'Frontend Lead', 'Next.js + shadcn/ui, Kanban, Gantt, Eisenhower, chi tiết task, UI mockup', ''],
    ['«TV4»', 'Realtime & AI', 'Socket.io, tích hợp Gemini, thuật toán tải/burn-down, test đơn vị thuật toán', ''],
    ['«TV5»', 'DevOps & QA', 'Supabase/Render/Vercel, CI, Web Push, kế hoạch & biên bản kiểm thử, dữ liệu mẫu', ''],
  ];
  const children = [
    ...letterhead(),
    subhead(),
    center('BIÊN BẢN HỌP NHÓM LẦN 1', { run: { bold: true, size: 30 } }),
    center('THÀNH LẬP NHÓM, BẦU NHÓM TRƯỞNG, CHỌN ĐỀ TÀI VÀ PHÂN CÔNG', { run: { bold: true }, after: 240 }),
    para('**Thời gian:** ……h……, ngày 11 tháng 09 năm 2026 (Tuần 01).', { align: AlignmentType.LEFT }),
    para('**Hình thức / địa điểm:** ………………………………………… (trực tiếp / Google Meet).', { align: AlignmentType.LEFT }),
    para('**Thành phần:** toàn bộ thành viên nhóm (danh sách tại mục 1). Vắng: không.', { align: AlignmentType.LEFT }),
    heading('1. Thành lập nhóm và bầu nhóm trưởng', 2),
    para('Nhóm gồm 05 sinh viên như sau (ô tô vàng: điền họ tên thật trước khi nộp); nhóm thống nhất bầu «TV1» làm nhóm trưởng, chịu trách nhiệm đầu mối liên hệ GVHD, điều phối tiến độ và quản lý Git repository.'),
    table(['TT', 'Họ và tên', 'MSSV', 'Lớp', 'Email / GitHub', 'Vai trò'], [
      ['1', '«TV1»', '', '', '', 'Nhóm trưởng'],
      ['2', '«TV2»', '', '', '', 'Thành viên'],
      ['3', '«TV3»', '', '', '', 'Thành viên'],
      ['4', '«TV4»', '', '', '', 'Thành viên'],
      ['5', '«TV5»', '', '', '', 'Thành viên'],
    ], [1, 4.2, 2.2, 2, 4, 2.6]),
    heading('2. Chọn đề tài', 2),
    para('Nhóm chọn **Đề tài 01 — Nền tảng Quản trị Dự án Thông minh & Cân bằng Tải Nhân sự tích hợp AI Agent** (*Smart Task & Workload Management Platform with AI Agent*), thuộc nhóm Web & Doanh nghiệp (kiến trúc API-First, Cloud miễn phí).'),
    para('Lý do chọn: bài toán phân việc theo cảm tính và phát hiện quá tải muộn là thực tế ở nhóm phát triển 5–30 người; các công cụ phổ biến (Jira, Trello, Asana) không có biểu đồ tải, ma trận kỹ năng và AI phân rã việc ở gói miễn phí; công nghệ yêu cầu (Next.js, NestJS, PostgreSQL/Supabase, Socket.io, Gemini) đều có gói miễn phí và nhóm đã có kinh nghiệm NestJS/Prisma.'),
    para('Phạm vi thống nhất (MoSCoW): 24 use case bắt buộc cho MVP (tài khoản, workspace, dự án, sprint, task/subtask, Kanban kéo thả realtime, bình luận @mention, đính kèm, thông báo, ma trận kỹ năng, tính tải & cảnh báo quá tải, AI phân rã, burn-down, dự báo rủi ro, dashboard); 13 use case nên có; 4 use case ghi vào hướng phát triển. Chi tiết trong bản phác thảo đề cương đính kèm.'),
    heading('3. Phân công vai trò và trách nhiệm', 2),
    para('Mỗi việc trong kế hoạch 12 tuần ghi rõ họ tên người thực hiện (không ghi "cả nhóm"). Vai trò phụ trách chính (R) như sau; mọi thành viên tham gia review chéo và viết phần báo cáo của mình.'),
    table(['Thành viên', 'Vai trò', 'Phụ trách chính', 'Ký tên'], roles, [3.8, 3, 7.2, 2]),
    heading('4. Git repository và quy tắc làm việc', 2),
    para('Repository: **github.com/…………………/SmartTask** (nhóm trưởng tạo, mời toàn bộ thành viên; nhánh `main` bảo vệ, chỉ merge qua Pull Request có 1 người review; nhánh `develop` tích hợp; nhánh `feature/<mã UC>-<mô tả>` cho từng việc).'),
    para('Commit bằng tài khoản cá nhân theo chuẩn Conventional Commits, gắn mã UC và tuần (ví dụ: `feat(tasks): move endpoint có kiểm tra version [UC-12] [Tuần 07]`) — commit log là căn cứ tính % đóng góp.'),
    para('Nhịp làm việc: họp kế hoạch 15 phút thứ Hai; demo nội bộ và gửi tiến độ cho GVHD thứ Sáu; biên bản lưu tại `docs/09-bien-ban/`.'),
    heading('5. Kết luận và việc tuần 02', 2),
    table(['Việc', 'Người thực hiện', 'Hạn'], [
      ['Hoàn thiện đề cương đủ 10 mục (Draft 2) từ bản phác thảo Mục 1–5', '«TV1» (tổng hợp), «TV3», «TV4», «TV5»', '23/09/2026'],
      ['Lập WBS 12 tuần gán họ tên từng việc', '«TV1»', '19/09/2026'],
      ['Cài môi trường phát triển: Docker PostgreSQL, IDE, nhánh Git, CI khung', '«TV2», «TV5»', '21/09/2026'],
      ['Dàn trang bản in đề cương (TNR 13, lề 3,5/2,0/2,5 cm)', '«TV3»', '23/09/2026'],
      ['Gửi Draft 2 cho GVHD và đặt lịch góp ý', '«TV1»', '24/09/2026'],
    ], [8.4, 5, 2.6]),
    para('Biên bản được đọc lại trước nhóm và thống nhất 100%. Cuộc họp kết thúc lúc ……h…… cùng ngày.'),
    blank(),
    signatureTable([{ title: 'NHÓM TRƯỞNG', note: '(ký, ghi rõ họ tên)', name: '«TV1»' }, { title: 'THƯ KÝ (người ghi biên bản)', note: '(ký, ghi rõ họ tên)', name: '«TV5»' }]),
    blank(),
    para('Xác nhận của GVHD: ………………………………………………………………………………', { align: AlignmentType.LEFT }),
  ];
  const doc = buildDoc(children, { title: 'Biên bản phân công nhóm — Tuần 01', headerText: 'SmartTask · Biên bản họp nhóm lần 1 · Tuần 01 (11/09/2026)' });
  fs.writeFileSync(path.join(OUT, '01-Bien-ban-phan-cong-nhom.docx'), await Packer.toBuffer(doc));

  // ───────────────────────── 2. Đề cương Draft 1 ─────────────────────────
  let md = fs.readFileSync(path.join(REPO, 'docs/01-de-cuong/de-cuong-chi-tiet.md'), 'utf8')
    .replace('> Phiên bản: **Draft 2 — Tuần 02** — đủ 10 mục; chờ điền họ tên thành viên và góp ý GVHD (Tuần 03).', '> Phiên bản: **Draft 1 — nộp Tuần 01 (11/09/2026)**. Yêu cầu tuần 1 là Mục 1–5; Mục 6–10 nhóm đã phác thảo trước để GVHD góp ý sớm, sẽ hoàn thiện ở Tuần 02 (Draft 2).')
    .replace(/^> Bản in nộp Tuần 02–03.*$/m, '');
  // Thông tin đầu (tên đề tài, GVHD, nhóm) đã nằm trên bìa → thân bắt đầu từ ghi chú phiên bản và Mục 1
  const versionNote = (md.match(/^> Phiên bản:.*$/m) || [''])[0];
  md = `# ĐỀ CƯƠNG\n\n${versionNote}\n\n` + md.slice(md.indexOf('## 1.'));
  const tableWidths = { 0: [4.0, 1.9, 2.4, 2.4, 2.4, 2.4], 1: [1.5, 3.0, 5.6, 3.2, 2.2] };
  const coverEls = coverPage({
    studentLines: ['Nhóm sinh viên thực hiện:', '«TV1» (nhóm trưởng), «TV2», «TV3», «TV4», «TV5»'],
    titleLines: ['ĐỀ CƯƠNG CHI TIẾT', 'ĐỒ ÁN CHUYÊN NGÀNH'],
    subtitle: ['XÂY DỰNG NỀN TẢNG QUẢN TRỊ DỰ ÁN THÔNG MINH', 'VÀ CÂN BẰNG TẢI NHÂN SỰ TÍCH HỢP AI AGENT'],
    info: [
      ['Học phần', 'Đồ án Chuyên ngành (841476)'],
      ['Giảng viên hướng dẫn', 'ThS. Trần Đình Nghĩa'],
      ['Đề tài', 'Số 01 — Smart Task & Workload Management Platform with AI Agent'],
      ['Phiên bản', 'Draft 1 — Tuần 01 (11/09/2026)'],
    ],
    placeDate: 'TP. Hồ Chí Minh, tháng 9 năm 2026',
  });
  const entries = tocEntriesFromMarkdown(md);
  const assemble = (toc) => {
    const body = markdownToDocx(md, { skipFirstHeading: true, tableWidths });
    return buildDoc([...coverEls, ...toc, new Paragraph({ children: [new (require('docx').PageBreak)()] }), ...body], { title: 'Đề cương chi tiết — Draft 1', headerText: 'SmartTask · Đề cương chi tiết (Draft 1) · Tuần 01' });
  };
  const out2 = path.join(OUT, '02-De-cuong-chi-tiet-Draft-1.docx');
  // Lượt 1: mục lục với số trang '?' → dựng PDF → tìm trang của từng tiêu đề → lượt 2 với số thật
  fs.writeFileSync(out2, await Packer.toBuffer(assemble(tocStatic(entries))));
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toc-'));
    execSync(`soffice --headless --convert-to pdf --outdir "${tmp}" "${out2}"`, { stdio: 'ignore', timeout: 120000 });
    const pdf = path.join(tmp, path.basename(out2).replace(/\.docx$/, '.pdf'));
    const pages = Number(execSync(`pdfinfo "${pdf}" | awk '/^Pages/{print $2}'`).toString().trim());
    const norm = (t) => t.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    const pageTexts = [];
    for (let i = 1; i <= pages; i += 1) pageTexts.push(norm(execSync(`pdftotext -layout -f ${i} -l ${i} "${pdf}" -`).toString()));
    const tocPages = new Set([2]); // trang mục lục (có thể 2 trang)
    for (const e of entries) {
      const key = norm(e.text).slice(0, 40);
      const idx = pageTexts.findIndex((t, i) => !tocPages.has(i + 1) && i > 0 && t.includes(key));
      e.page = idx >= 0 ? idx + 1 : '';
    }
    fs.writeFileSync(out2, await Packer.toBuffer(assemble(tocStatic(entries))));
    console.log(`Mục lục: ${entries.filter((e) => e.page).length}/${entries.length} mục có số trang; PDF ${pages} trang`);
  } catch (e) {
    console.log('Không dựng được PDF để đánh số mục lục (cần soffice/pdftotext):', e.message);
  }
  console.log('Đã tạo:', fs.readdirSync(OUT).join(', '));
})();
