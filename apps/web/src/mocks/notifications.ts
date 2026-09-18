export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  dateGroup: "Hôm nay" | "Hôm qua" | "Tuần trước";
  read: boolean;
  type: "task" | "workload" | "ai" | "mention" | "warning";
  linkUrl?: string;
  actor?: { name: string; avatar: string };
}

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Thẻ ST-7 vừa được cập nhật",
    message: "Lan vừa cập nhật mô tả kỹ thuật và tiêu chí chấp nhận cho thẻ ST-7.",
    timestamp: "10 phút trước",
    dateGroup: "Hôm nay",
    read: false,
    type: "task",
    actor: { name: "Lan", avatar: "" },
    linkUrl: "/projects/ST/board",
  },
  {
    id: "notif-2",
    title: "Cảnh báo quá tải nhân sự",
    message: "Huy đã đạt mức tải 118% (vượt ngưỡng 110%) với 2 công việc quá hạn.",
    timestamp: "1 giờ trước",
    dateGroup: "Hôm nay",
    read: false,
    type: "warning",
    linkUrl: "/projects/ST/workload",
  },
  {
    id: "notif-3",
    title: "Đề xuất cân bằng tải mới từ AI Agent",
    message: "AI Agent vừa tạo phương án giảm Spread tải từ 41% xuống 18% bằng cách chuyển 2 task sang An.",
    timestamp: "3 giờ trước",
    dateGroup: "Hôm nay",
    read: false,
    type: "ai",
    linkUrl: "/projects/ST/rebalance",
  },
  {
    id: "notif-4",
    title: "Lan đã nhắc đến bạn trong bình luận ST-7",
    message: "@Minh chú ý test kỹ partition theo tháng nhé, snapshot tích luỹ khá nhanh.",
    timestamp: "Hôm qua lúc 14:20",
    dateGroup: "Hôm qua",
    read: true,
    type: "mention",
    actor: { name: "Lan", avatar: "" },
    linkUrl: "/projects/ST/board",
  },
  {
    id: "notif-5",
    title: "Công việc ST-12 bị quá hạn 1 ngày",
    message: "Hạn hoàn thành ban đầu là 25/10/2026. Vui lòng kiểm tra và cập nhật tiến độ.",
    timestamp: "Hôm qua lúc 09:00",
    dateGroup: "Hôm qua",
    read: true,
    type: "warning",
    linkUrl: "/projects/ST/board",
  },
  {
    id: "notif-6",
    title: "Minh đã xác nhận hoàn thành ST-6",
    message: "Migration database ban đầu đã được merge vào nhánh chính.",
    timestamp: "24/10 lúc 17:00",
    dateGroup: "Tuần trước",
    read: true,
    type: "task",
    actor: { name: "Minh", avatar: "" },
    linkUrl: "/projects/ST/board",
  },
];
