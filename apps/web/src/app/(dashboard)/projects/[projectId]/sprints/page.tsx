import { redirect } from "next/navigation";

/** Đường dẫn cũ /sprints → chuyển hướng chuẩn xác về /dashboard (giữ nguyên tham số sprint) */
export default async function LegacySprintsPage({
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
  const query = sp.toString();
  redirect(`/projects/${projectId}/dashboard${query ? `?${query}` : ""}`);
}
