# 10 · Quy ước giao diện — shadcn/ui là nguồn duy nhất

Mục tiêu: 5 người code 14 màn hình trong 2 tuần mà giao diện nhìn như một người làm. Cách duy nhất đạt được là **không ai tự vẽ nút, thẻ, ô nhập** — tất cả lấy từ `components/ui/` (shadcn/ui), chỉnh qua token và variant.

## 1. Ba tầng component

```
components/ui/        shadcn/ui — primitive (Button, Card, Badge, Sheet, Combobox, Table, Chart, …)
                      Sao chép vào repo bằng `npx shadcn add`. Chỉ sửa khi cả nhóm đồng ý và ghi vào PR.
components/app/       Component nghiệp vụ dùng lại ≥ 2 nơi: TaskCard, PriorityBadge, UserAvatar, WorkloadBar,
                      SkillLevel, EmptyState, PageHeader, ConfirmDialog — ghép từ ui/, KHÔNG tự viết style.
features/<tên>/       Màn hình và component chỉ dùng trong một feature (BoardColumn, AssignPreviewTable…).
```

Quy tắc import: `features/*` chỉ import từ `@/components/ui`, `@/components/app`, `@/lib`, `@/features/<chính nó>`; không import chéo giữa feature (dùng `components/app` nếu cần chung).

## 2. Cấm và bắt buộc

| Cấm | Thay bằng |
|---|---|
| `<button>`, `<input>`, `<select>`, `<textarea>`, `<a className=…>` thô trong `features/` và `app/` | `Button`, `Input`, `Select`/`Combobox`, `Textarea`, `Button asChild` + `Link` |
| `<div className="rounded-lg border p-4 shadow">` tự chế thẻ | `Card`, `CardHeader`, `CardContent` |
| Mã màu hex / `bg-blue-500` trong component | Token: `bg-primary`, `text-muted-foreground`, `bg-destructive`, `text-warning`, `bg-success`, `--chart-1..5` |
| `window.alert`, `window.confirm` | `Sonner` (toast), `AlertDialog` |
| Popup/drawer tự viết bằng `position: fixed` | `Dialog`, `Sheet`, `Popover`, `DropdownMenu` |
| Bảng `<table>` tự viết | `Table` (+ TanStack Table theo mẫu DataTable của shadcn) |
| Icon từ nhiều bộ | Chỉ `lucide-react`, kích thước 16/20 |
| Cài bộ UI thứ hai (MUI, Ant, Chakra, Bootstrap…) | Không. Thiếu component → tìm trong shadcn registry trước, rồi mới bàn |

Bắt buộc mỗi màn hình có đủ 4 trạng thái: **đang tải** (`Skeleton` đúng hình dạng), **rỗng** (`EmptyState` có minh hoạ + nút hành động), **lỗi** (`Alert` với mã lỗi từ `packages/shared`), **có dữ liệu**.

## 3. Token thiết kế (một nơi: `app/globals.css`)

shadcn sinh sẵn `--background, --foreground, --primary, --secondary, --muted, --accent, --destructive, --border, --ring, --chart-1..5`. Nhóm **thêm** và chỉ dùng thêm các token sau (định nghĩa cả `:root` và `.dark`):

| Token | Dùng cho |
|---|---|
| `--success` / `--success-foreground` | Mức tải Bình thường, task hoàn thành, kiểm tra ✓ |
| `--warning` / `--warning-foreground` | Mức tải Cao/Đầy, rủi ro Trung bình, vượt WIP |
| `--destructive` (có sẵn) | Quá tải, burnout, quá hạn, rủi ro Cao |
| `--info` / `--info-foreground` | Huy hiệu "nguồn AI", thẻ đề xuất chờ xác nhận |
| `--chart-1..5` (có sẵn) | Mức kỹ năng 1–5 trên heatmap; series biểu đồ |

Màu trạng thái task/tải/rủi ro **chỉ** lấy từ bảng ánh xạ trong `lib/status.ts` (`levelToVariant(level)`, `priorityToVariant(p)`) — không quyết định màu trong component.

## 4. Biến thể (variant) thống nhất

Mở rộng bằng `cva` ngay trong file `components/ui/*.tsx` đã sao chép, không tạo component song song:

```ts
// components/ui/badge.tsx — thêm 3 variant, giữ nguyên các variant gốc
variants: { variant: {
  default:..., secondary:..., destructive:..., outline:...,
  success: "border-transparent bg-success text-success-foreground",
  warning: "border-transparent bg-warning text-warning-foreground",
  info:    "border-transparent bg-info text-info-foreground",
}}
```

| Component | Variant/size được dùng | Ghi chú |
|---|---|---|
| `Button` | `default` (hành động chính, 1 nút/màn), `secondary`, `outline`, `ghost` (icon, hàng bảng), `destructive`, `link`; size `sm` trong bảng/thẻ, `default` ở form, `icon` cho nút icon | Nút đang xử lý: `disabled` + `<Loader2 className="animate-spin" />`, nhãn giữ nguyên |
| `Badge` | `secondary` (nhãn), `outline` (mã task ST-12), `success/warning/destructive` (mức tải, hạn), `info` (AI) | Không dùng Badge làm nút |
| `Card` | Mặc định; thẻ Kanban dùng `Card` với `p-3` qua `className` — không đổi `rounded` | |
| `Sheet` | Chi tiết tải (side right, `sm:max-w-lg`) | Đóng bằng Esc, có tiêu đề |
| `Dialog` | Form ngắn (tạo sprint, mời thành viên); **chi tiết công việc** (`sm:max-w-3xl`, `max-h-[88vh]`, thân cuộn trong) — đổi từ `Sheet` sang modal giữa màn vì nội dung dàn hai cột cần bề ngang; `AlertDialog` cho hành động không hoàn tác | Chi tiết công việc còn có trang riêng `/projects/:id/tasks/ST-n` dùng chung `TaskDetailBody` |
| `Sonner` | Mọi phản hồi kết quả: "Đã tạo 9 công việc", "Thẻ vừa được Lan cập nhật" | Không dùng toast cho lỗi form (hiện tại chỗ) |
| `Combobox` (Command + Popover) | Chọn người, kỹ năng, sprint; hiển thị avatar + bảng sự thật nhỏ khi giao việc | Mẫu shadcn "Combobox" |
| `Table` | Danh sách, xem trước AI, heatmap kỹ năng | Số dùng `tabular-nums` |
| `Chart` | Tải (BarChart stacked), burn-down (LineChart/AreaChart) | Chỉ `ChartContainer`/`ChartTooltip` của shadcn |

## 5. Khoảng cách, chữ, bố cục

- Chỉ dùng thang Tailwind `1 2 3 4 6 8 12 16` (4 px × n); không `p-[13px]`.
- Chữ: `text-sm` mặc định trong bảng/thẻ, `text-base` ở form và nội dung, tiêu đề trang `text-2xl font-semibold`, tiêu đề mục `text-lg font-medium`; không đổi font-family (font hệ thống + `next/font` Inter nếu chọn).
- Bố cục trang: `PageHeader` (tiêu đề, breadcrumb, nút chính bên phải) → nội dung `max-w-screen-2xl mx-auto p-6`; bảng rộng cuộn trong `ScrollArea`, không để trang cuộn ngang.
- Responsive: ≥ 1024 px là mục tiêu; < 768 px chỉ cần list, chi tiết task, thông báo dùng được.

## 6. Truy cập và bàn phím

- Không tự viết focus ring; Radix và `--ring` lo. Không `outline-none` nếu không có thay thế.
- Kéo thả: bật `KeyboardSensor` của dnd-kit; mọi hành động kéo có nút tương đương trong `DropdownMenu` của thẻ ("Chuyển sang cột…").
- Icon-only button bắt buộc `aria-label`; `Tooltip` kèm theo.
- Kiểm tra bằng axe DevTools ở Tuần 09; tương phản AA cho các token thêm (`--warning` trên nền sáng dùng chữ tối).

## 7. Kiểm tra tự động

`eslint.config.mjs` của `apps/web` thêm quy tắc cấm phần tử thô trong `features/` và `app/`:

```js
{
  files: ["src/features/**/*.tsx", "src/app/**/*.tsx"],
  rules: {
    "no-restricted-syntax": ["error",
      { selector: "JSXOpeningElement[name.name='button']",   message: "Dùng <Button> từ @/components/ui/button" },
      { selector: "JSXOpeningElement[name.name='input']",    message: "Dùng <Input> từ @/components/ui/input" },
      { selector: "JSXOpeningElement[name.name='select']",   message: "Dùng <Select>/<Combobox>" },
      { selector: "JSXOpeningElement[name.name='textarea']", message: "Dùng <Textarea>" },
      { selector: "JSXOpeningElement[name.name='table']",    message: "Dùng <Table> từ @/components/ui/table" },
    ],
    "no-restricted-imports": ["error", { patterns: [
      { group: ["@mui/*", "antd", "@chakra-ui/*", "react-bootstrap", "bootstrap"], message: "Chỉ dùng shadcn/ui" },
      { group: ["@/features/*"], message: "Không import chéo giữa feature; đưa vào components/app" },
    ]}],
  },
}
```

`components/ui/` được loại khỏi quy tắc trên (shadcn dùng phần tử thô bên trong). Thêm vào checklist PR: "Chỉ dùng component shadcn/ui hoặc components/app; không màu hex; đủ 4 trạng thái".

## 8. Thứ tự việc ở Tuần 07 cho Frontend Lead («TV3»)

1. `create-next-app` + `shadcn init` (style `new-york`, base color `slate`, CSS variables bật).
2. Thêm token `--success/--warning/--info` + `.dark`; thêm variant Badge/Button; `lib/status.ts`.
3. `components/app/`: PageHeader, EmptyState, TaskCard, PriorityBadge, UserAvatar, WorkloadBar, SkillLevel, ConfirmDialog — mỗi cái có story ngắn trong `app/(dev)/kit/page.tsx` (trang "bộ kit" nội bộ để cả nhóm xem và dùng đúng).
4. AppShell (Sidebar + Breadcrumb + chuông + ⌘K) và trang đăng nhập.
5. Chỉ sau bước 3 các thành viên khác mới bắt đầu màn hình của mình.
