/** Định dạng dùng chung trong màn Nhân sự — số và ngày kiểu Việt (docs 10). */
export const vn = (n: number, digits = 1) => n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
export const hrs = (n: number) => `${vn(n)} h`;
export const pct = (r: number) => `${Math.round(r * 100)}%`;
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
