import { redirect } from "next/navigation";

export default async function AIDecomposePage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  redirect(`/projects/${projectKey}/assistant`);
}
