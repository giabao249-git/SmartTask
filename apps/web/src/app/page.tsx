import { redirect } from "next/navigation";

export default function RootPage() {
  // Mặc định chuyển thẳng tới màn hình trọng tâm: Bảng Kanban Sprint 3
  redirect("/projects/ST/board");
}
