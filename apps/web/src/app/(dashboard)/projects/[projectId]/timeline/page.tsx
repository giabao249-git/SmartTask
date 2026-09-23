import { redirect } from "next/navigation";

/** Đường cũ (thông báo, bảng lệnh, link đã chia sẻ) → màn Công việc, giữ nguyên ?task= và các tham số lọc. */
export default async function LegacyPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") sp.set(k, v);
    else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);
  }
  sp.set("view", "timeline");
  redirect(`/projects/${projectId}/work?${sp.toString()}`);
}
