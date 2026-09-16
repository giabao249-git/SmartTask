# Sinh file Word nộp từ Markdown

Mọi hồ sơ nộp (`.docx`, Times New Roman 13, giãn dòng 1.3, lề trên/dưới 2,5 – trái 3,5 – phải 2,0 cm, A4) được sinh từ Markdown trong `docs/` để nội dung chỉ có một nguồn.

```bash
npm i --prefix scripts/docx docx@^9        # một lần
node scripts/docx/build-tuan-01.js          # → docs/01-de-cuong/nop/tuan-01/*.docx
```

- `lib.js`: bộ dựng theo mẫu `CHƯƠNG 1.docx` của Khoa: trang bìa (ỦY BAN NHÂN DÂN → TRƯỜNG → KHOA, gạch ngang, logo SGU `assets/sgu-logo.png`, tiêu đề 28pt, bảng thông tin nhãn : giá trị, nơi/tháng), mục lục tĩnh có số trang thật (dựng PDF thử bằng LibreOffice rồi đánh số — hiện đúng trên Word/OnlyOffice/LibreOffice, không cần cập nhật field), thân TNR 13 giãn dòng 1.5, mục cấp 1 in hoa đậm 14pt; chuyển Markdown đơn giản (tiêu đề, đoạn, danh sách, bảng, trích dẫn); `«TV1»…«TV5»` tô vàng — thay bằng họ tên thật trước khi nộp.
- Kiểm tra hình thức: `soffice --headless --convert-to pdf file.docx` rồi xem PDF.
- Tuần sau: sao chép `build-tuan-01.js` thành `build-tuan-02.js`, đổi nguồn Markdown và tên file.
