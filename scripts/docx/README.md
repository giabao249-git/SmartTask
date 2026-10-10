# Sinh file Word nộp từ Markdown

Mọi hồ sơ nộp (`.docx`, A4, Times New Roman 13, lề trên/dưới 2,5 – trái 3,5 – phải 2,0 cm theo PDF Khoa tr. 6) được sinh từ Markdown trong `docs/` để nội dung chỉ có một nguồn. Thân bài quyển báo cáo giãn dòng 1.5 (`LINE = 360` trong `lib.js`); đề cương theo mẫu Khoa giãn 1.4. Bảng: chữ 12 pt, giãn ≈ 1.05.

```bash
npm i --prefix scripts/docx docx@^9        # một lần (docx-js 9.x)
node scripts/docx/build-bao-cao.js Draft-3  # → docs/06-bao-cao/nop/Bao-cao-tieu-luan-Draft-3.docx + .pdf
BAO_CAO_OUT=/tmp/thu node scripts/docx/build-bao-cao.js Draft-3   # dựng thử ra thư mục khác
```

**Không chạy** `build-de-cuong.js`, `build-tuan-01.js`, `docs/01-de-cuong/nop/tuan-04/nguon/build-chuong3.js` trong cây chính: cả ba ghi vào đường dẫn cố định của bản đã nộp. Muốn thử thì chép ra thư mục tạm và đổi đường dẫn ra. `build-bao-cao.js` bắt buộc có nhãn và từ chối `Draft-1`, `Draft-2` (đã nộp).

## Quyển báo cáo (`build-bao-cao.js`)

Thứ tự 11 phần theo PDF Khoa tr. 6, mỗi phần một section (`buildDocSections` trong `lib.js`):

| Section | Nội dung | Số trang |
|---|---|---|
| 1 | Bìa chính | không in |
| 2 | Trang trắng hoàn toàn: chỗ chèn biên bản chấm báo cáo | không in |
| 3 | Đề cương đã duyệt: 14 ảnh A4 `docs/06-bao-cao/de-cuong-da-duyet/de-cuong-trang-NN.png`, lề 0 (số "Trang N" trong ảnh là của đề cương) | không in |
| 4 | Lời cam đoan, lời cảm ơn, mục lục, danh mục chữ viết tắt, danh mục bảng, danh mục hình | "Trang i, ii, …" (La Mã, từ i) |
| 5 | Bìa phụ | không in |
| 6… | Chương 1 → tài liệu tham khảo → phụ lục; mỗi hình `{ngang}` là một section trang ngang chen giữa | "Trang 1, 2, …" (từ 1 ở Chương 1, chạy liên tục qua trang ngang) |

Footer "Trang N" canh giữa, Times New Roman 11. Bìa chính và bìa phụ dùng khuôn bìa đề cương (`coverDeCuong` với `docLine`, `placeLine`, `pageBreak: false`). Tiêu đề cấp 1 (phần đầu, chương, TLTK, PHỤ LỤC) căn giữa, in hoa, đậm 14 pt, sang trang; tiêu đề Phụ lục A–F căn giữa (`headingExtra`). Hàng tiêu đề bảng căn giữa và được giữ cùng trang với hàng dữ liệu đầu. Ảnh đề cương dựng lại khi đổi bản đề cương: `soffice --headless --convert-to pdf …docx` rồi `pdftoppm -r 300 -png`.

**Mục lục** là trường TOC thật (`TOC \o "1-3" \h \z \u`), lấy tiêu đề cấp 1–3 (`##`, `###`, `####`). Bên trong trường là các dòng mục lục dựng sẵn (style TOC1–3) với số trang **in trên trang**: lượt hai dựng PDF thử bằng LibreOffice, đọc dòng "Trang xx" ở chân từng trang (kể cả số La Mã). LibreOffice hiện đúng ngay; Word bấm F9 (hoặc đồng ý cập nhật trường khi mở) để dựng lại theo phân trang của Word. Danh mục bảng và danh mục hình là danh sách tĩnh, cùng cách lấy số trang. Lượt ba dựng PDF bản cuối cạnh `.docx` và in số mục khớp / lệch.

`finalizeDocx` hậu xử lý `document.xml`: thay hai mốc TOC bằng `fldChar`; gắn `sectPr` vào đoạn cuối của mỗi section (docx-js tạo thêm một đoạn rỗng chứa `sectPr`, đoạn này tràn thành trang trắng sau ảnh tràn trang).

## Quy ước Markdown (chế độ `report`)

- Tiêu đề: `##` chương (in hoa, sang trang), `###` mục x.y, `####` mục x.y.z. Mỗi `### Phụ lục B…F` sang trang mới.
- Hình: `![Hình 3.1. Tên hình](hinh/x.png)` → ảnh canh giữa, chú thích **dưới** hình, nghiêng 13 pt. Khung trang dọc 15,5 × 22,5 cm, ảnh không phóng to (coi là ảnh 2x).
- Hình ngang: thêm `{ngang}` cuối dòng: `![Hình 4.6. Tên](hinh/x.png){ngang}`. Hình nằm trong section **landscape** 29,7 × 21 cm, lề **trên 3,5 cm (cạnh gáy khi đóng quyển)**, dưới 2,0, trái 2,5, phải 2,5; vùng in ≈ 24,7 × 15,5 cm, ảnh tối đa 24,7 × 14,2 cm (phóng to cho vừa), phần còn lại cho chú thích và dòng nguồn. **In thử một trang ngang trước khi in cả quyển** để kiểm cạnh gáy nằm đúng phía đóng quyển.
- Bảng: dòng chú thích `Bảng 3.2. Tên bảng` đặt **trên** bảng (nghiêng 13 pt, canh giữa, giữ cùng trang với bảng). Độ rộng cột khai trong `TABLE_WIDTHS` của `build-bao-cao.js` theo khoá chú thích (`'Bảng 3.2': [3.6, 5.8, 6.1]`, tổng ≤ 15,5 cm); khoá số thứ tự bảng (`0`, `1`, …) vẫn dùng được cho script cũ. Bảng thiếu khai báo hoặc khai sai số cột được chia đều và bị báo khi dựng. Bảng ở chế độ `report` có bố cục cố định (`tblLayout fixed`), canh giữa, và chuỗi dài không khoảng trắng (tên cột, đường dẫn API, kiểu enum) được chèn điểm ngắt mềm U+200B sau `_ . / , ( = { } -` và giữa chữ thường–hoa: thiếu bố cục cố định thì Word tự nới cột theo từ dài nhất (autofit) làm bảng tràn lề phải, trông lệch một bên, còn LibreOffice vẫn giữ đúng độ rộng nên bản PDF không lộ lỗi.
- Nguồn: một dòng bắt đầu `Nguồn:` ngay sau dòng hình hoặc ngay sau bảng → in nghiêng 12 pt, canh giữa, ngay dưới hình/bảng (với hình: dưới chú thích). Ba dạng: `Nguồn: Nhóm thực hiện`, `Nguồn: Nhóm tổng hợp từ [n], [m]`, `Nguồn: Màn hình chức năng <tên> của hệ thống SmartTask`.
- Trần chiều cao riêng của một hình dọc: thêm `{cao=21}` (cm) cuối dòng hình. Dùng khi vài dòng cuối của đoạn trước hình tràn sang trang mới và hình cao gần trọn trang bị đẩy sang trang tiếp, để lại trang chỉ có vài dòng; phụ thuộc phân trang nên phải xem lại khi nội dung phía trước đổi.
- Công thức đánh số: `$$ EffCap(u, w) = … $$ (3.1)` → công thức canh giữa, số sát lề phải.
- Đoạn văn mở đầu bằng "Hình 3.1 cho thấy…" (không có dấu chấm sau số) là đoạn thường, không phải chú thích.

## Các script khác

- `lib.js`: thư viện chung. Chế độ `template` (đề cương theo `Mau_DeCuong.docx`: mục 1..10 đậm 13 pt, thụt đầu dòng 1,27 cm, giãn 1.4, lề 2,3/2,3/3,0/1,5 cm) giữ nguyên bố cục cũ; chữ ký `buildDoc(children, opts)` và `markdownToDocx(md, opts)` cũ vẫn chạy (`buildDoc` tự tách section ngang nếu gặp hình `{ngang}`). `styles.xml` chỉ có một bộ Heading 1–3 (ghi đè style mặc định của docx-js).
- `build-de-cuong.js`: dựng **Đề cương tiểu luận** theo mẫu Khoa (bìa 3 dòng đầu trang 16 pt, logo SGU, tên đề tài, NHÓM, Sinh viên/GVHD; không mục lục). Ghi vào `docs/01-de-cuong/nop/tuan-03/` — đã nộp, không chạy lại.
- `build-tuan-01.js`: biên bản và đề cương Tuần 01 — đã nộp, không chạy lại.
- Kiểm tra hình thức: `soffice --headless --convert-to pdf file.docx` rồi xem PDF. Lưu ý: không đặt `cantSplit` cho dòng bảng — LibreOffice bỏ mất các dòng còn lại của bảng khi bảng vắt trang.
