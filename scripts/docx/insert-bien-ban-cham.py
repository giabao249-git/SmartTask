# Chèn "Biên bản đánh giá đề cương" (theo mẫu Khoa) thành trang đầu của file đề cương.
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SRC = '/home/dthai24/Documents/262701-DACN-01-Nhom2B_DC_Cham_Tuan03-v2.docx'
DST = '/home/dthai24/Documents/262701-DACN-01-Nhom2B_DC_Cham_Tuan03-v3.docx'

FONT = 'Times New Roman'
SV = [('3122410380', 'Nguyễn Duy Thái'), ('3123410039', 'Lê Mạnh Cường'),
      ('3123410025', 'Nguyễn Âu Gia Bảo'), ('3123410219', 'Nguyễn Khả Minh'),
      ('3121560039', 'Trần Thanh Huy')]
THANG = [
    ('Nêu bật được lý do chọn đề tài, phù hợp thực tế', '1đ'),
    ('Nêu được những giải pháp, nghiên cứu đã có liên quan', '1đ'),
    ('Khoanh vùng được đối tượng, phạm vi áp dụng', '1đ'),
    ('Phương pháp nghiên cứu/triển khai phù hợp', '0,5đ'),
    ('Nêu được điểm mới trong vấn đề do nhóm thực hiện', '1đ'),
    ('Kế hoạch thực hiện chi tiết, đầy đủ thông tin', '1đ'),
    ('Các chương dự kiến hợp lý, bao quát đủ nội dung', '1đ'),
    ('Các chương dự kiến tách biệt rõ ràng các nội dung liên quan theo trình tự', '1đ'),
    ('Tài liệu tham khảo', '0,5đ'),
    ('Trình bày đúng font, cỡ chữ, canh lề…', '2đ'),
]

d = Document(SRC)
body = d.element.body

# File nguồn đã có một biên bản dán từ PDF nhưng vỡ định dạng (từ đầu tài liệu đến trước trang bìa).
# Xoá khối đó rồi dựng lại bằng bảng Word đúng mẫu.
children = list(body.iterchildren())
start_cover = next(i for i, el in enumerate(children)
                   if el.tag == qn('w:p') and 'ỦY BAN NHÂN DÂN' in ''.join(el.itertext()))
for el in children[:start_cover]:
    body.remove(el)
anchor = children[start_cover]       # dòng đầu trang bìa đề cương
made = []                            # các phần tử sẽ chèn trước anchor, theo thứ tự

def style_run(r, *, bold=False, italic=False, size=13, underline=False):
    r.bold = bold or None
    r.italic = italic or None
    r.underline = underline or None
    r.font.name = FONT
    r.font.size = Pt(size)
    rPr = r._element.get_or_add_rPr()
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rPr.append(rf)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs'):
        rf.set(qn(a), FONT)

def new_par(text='', *, align=None, bold=False, italic=False, size=13, space_after=0,
            space_before=0, line=1.15, underline=False, indent_left=None):
    p = d.add_paragraph()
    if align is not None: p.alignment = align
    pf = p.paragraph_format
    pf.space_after = Pt(space_after); pf.space_before = Pt(space_before)
    pf.line_spacing = line
    if indent_left is not None: pf.left_indent = Cm(indent_left)
    if text:
        style_run(p.add_run(text), bold=bold, italic=italic, size=size, underline=underline)
    made.append(p._p)
    return p

def cell_text(c, text, *, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, size=13):
    p = c.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    if text:
        style_run(p.add_run(text), bold=bold, size=size)

def shade(c, fill='D9D9D9'):
    tcPr = c._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:fill'), fill)
    tcPr.append(sh)

# ── Quốc hiệu: bảng 2 cột không viền ──────────────────────────────────────────
head = d.add_table(rows=2, cols=2); head.autofit = False
head.columns[0].width = Cm(7.0); head.columns[1].width = Cm(9.5)
for r in head.rows:
    for i, c in enumerate(r.cells):
        c.width = Cm(7.0 if i == 0 else 9.5)
        tcPr = c._tc.get_or_add_tcPr()
        mar = OxmlElement('w:tcMar')
        for side in ('top', 'start', 'bottom', 'end'):
            e = OxmlElement('w:' + side); e.set(qn('w:w'), '0'); e.set(qn('w:type'), 'dxa'); mar.append(e)
        tcPr.append(mar)
cell_text(head.cell(0, 0), 'TRƯỜNG ĐẠI HỌC SÀI GÒN', bold=True, size=12)
cell_text(head.cell(0, 1), 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold=True, size=12)
cell_text(head.cell(1, 0), 'KHOA CÔNG NGHỆ THÔNG TIN', bold=True, size=12)
cell_text(head.cell(1, 1), 'Độc lập – Tự do – Hạnh phúc', bold=True, size=12)
for c in (head.cell(1, 0), head.cell(1, 1)):     # gạch chân dòng dưới như mẫu
    for r in c.paragraphs[0].runs: r.underline = True
made.append(head._tbl)

new_par('Thành phố Hồ Chí Minh, ngày        tháng        năm 2026',
        align=WD_ALIGN_PARAGRAPH.RIGHT, italic=True, space_before=6, space_after=6)
new_par('BIÊN BẢN ĐÁNH GIÁ ĐỀ CƯƠNG', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, size=16, space_after=2)
new_par('Học phần: Đồ án chuyên ngành – Mã học phần: 841476 – Nhóm/lớp: 03',
        align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)

p = new_par(space_after=4)
style_run(p.add_run('Nhóm số: 2B'))
style_run(p.add_run('\t'))
style_run(p.add_run('Tên đồ án: SmartTask – Quản trị dự án thông minh và cân bằng tải nhân sự tích hợp AI Agent'))
p.paragraph_format.tab_stops.add_tab_stop(Cm(3.6), WD_TAB_ALIGNMENT.LEFT)
p.paragraph_format.left_indent = Cm(3.6); p.paragraph_format.first_line_indent = Cm(-3.6)

# ── Bảng điểm ─────────────────────────────────────────────────────────────────
COLS = [(1.1, 'TT'), (3.0, 'MSSV'), (4.2, 'Họ tên'), (1.6, '% cá nhân'),
        (2.4, 'Điểm SV tự chấm / GV'), (2.0, 'Điểm GV chấm'), (2.2, 'Ký tên')]
t = d.add_table(rows=6, cols=len(COLS))
t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.autofit = False
for i, (w, title) in enumerate(COLS):
    t.columns[i].width = Cm(w)
    for r in t.rows: r.cells[i].width = Cm(w)
    cell_text(t.cell(0, i), title, bold=True, size=12)
t.rows[0].height = Cm(1.6)
for i, (mssv, ten) in enumerate(SV, start=1):
    cell_text(t.cell(i, 0), str(i))
    cell_text(t.cell(i, 1), mssv)
    cell_text(t.cell(i, 2), ten, align=WD_ALIGN_PARAGRAPH.LEFT)
    for j in (3, 5, 6): cell_text(t.cell(i, j), '')
    t.rows[i].height = Cm(0.8)
t.cell(1, 4).merge(t.cell(5, 4))                 # cột "Điểm SV tự chấm/GV" gộp dọc như mẫu
for i in range(1, 6): shade(t.cell(i, 5))        # cột GV chấm tô xám như mẫu
made.append(t._tbl)

new_par(space_after=2)
new_par('Thang chấm:', bold=True, space_after=4)
for i, (text, diem) in enumerate(THANG, start=1):
    p = new_par(space_after=1, indent_left=0.8, line=1.1)
    style_run(p.add_run(f'{i}. {text} '))
    style_run(p.add_run('\t' + diem))
    p.paragraph_format.tab_stops.add_tab_stop(Cm(16.0), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)

new_par(space_after=2)
new_par('Giảng viên chấm', align=WD_ALIGN_PARAGRAPH.RIGHT, bold=True, space_after=34)
last = new_par('Trần Đình Nghĩa', align=WD_ALIGN_PARAGRAPH.RIGHT, bold=True)
last.add_run().add_break(WD_BREAK.PAGE)          # sang trang: bìa đề cương bắt đầu trang 2

import copy
sect = body.find(qn('w:sectPr'))                  # kết thúc phần biên bản bằng một section riêng
sep = OxmlElement('w:p'); pPr = OxmlElement('w:pPr'); pPr.append(copy.deepcopy(sect)); sep.append(pPr)
made.append(sep)

for el in made:                                   # đưa toàn bộ lên đầu tài liệu
    anchor.addprevious(el)

d.save(DST)

d2 = Document(DST)                                # lượt hai: bỏ số trang ở biên bản, phần sau đánh lại từ 1
s0 = d2.sections[0]                               # trang biên bản: dùng chân trang riêng, để trống
s0.different_first_page_header_footer = True
s0.first_page_footer.is_linked_to_previous = False
sectPr1 = d2.sections[1]._sectPr
num = OxmlElement('w:pgNumType'); num.set(qn('w:start'), '1')
sectPr1.append(num)
d2.save(DST)
print('Đã ghi:', DST)
