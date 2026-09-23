import { redirect } from "next/navigation";

/** Đường cũ → màn Nhân sự (tab tương ứng). */
export default async function LegacyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/people?tab=balance`);
}
