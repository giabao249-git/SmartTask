export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  timestamp: string;
  text?: string;
  actionCard?: {
    type: "RESCHEDULE_TASK" | "REBALANCE_WORKLOAD" | "DECOMPOSE_REQUIREMENT" | "EXPLAIN_BURNOUT";
    title: string;
    description: string;
    payloadJson: Record<string, unknown>;
    status: "pending" | "confirmed" | "modified" | "rejected";
    confirmLabel?: string;
    modifyLabel?: string;
  };
}

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "ai",
    timestamp: "08:15",
    text: "Chào Lan! Tôi đã phân tích hiện trạng Sprint 3 của VNPT Dev Team. Có 1 thành viên đang quá tải (Huy: 118%) và 2 task đang quá hạn. Bạn có muốn tôi hỗ trợ gì không?",
  },
  {
    id: "msg-2",
    sender: "user",
    timestamp: "08:20",
    text: "/rebalance Đề xuất giải pháp giảm tải cho Huy trong tuần này",
  },
  {
    id: "msg-3",
    sender: "ai",
    timestamp: "08:21",
    text: "Dựa trên phân tích kỹ năng và giờ trống, tôi nhận thấy An (Fullstack) mới đạt 30% tải và có 18 giờ trống trước ngày 29/10. Tôi đề xuất kế hoạch tái phân bổ sau:",
    actionCard: {
      type: "REBALANCE_WORKLOAD",
      title: "Chuyển giao ST-16 và ST-9 từ Huy sang An",
      description: "Hạ tải của Huy từ 118% xuống 88% (an toàn), nâng tải của An từ 30% lên 68%. Độ chênh Spread giảm từ 41% xuống 18%.",
      payloadJson: {
        action: "TRANSFER_TASKS",
        fromUserId: "user-huy",
        toUserId: "user-an",
        tasks: [
          { code: "ST-16", estimate: "6h" },
          { code: "ST-9", estimate: "10h" },
        ],
        projectKey: "ST",
        sprint: "Sprint 3",
      },
      status: "pending",
      confirmLabel: "Xác nhận chuyển việc",
      modifyLabel: "Tùy chỉnh",
    },
  },
  {
    id: "msg-4",
    sender: "user",
    timestamp: "08:28",
    text: "ST-9 deadline 27/10 có bị gấp quá cho An không?",
  },
  {
    id: "msg-5",
    sender: "ai",
    timestamp: "08:29",
    text: "Theo lịch của An, ngày 27/10 có cuộc họp Refinement 1h. Nếu An nhận ST-9 (10h), tôi khuyên bạn nên lùi deadline sang thứ Sáu (30/10) để An có 2 focus blocks hoàn thành trọn vẹn.",
    actionCard: {
      type: "RESCHEDULE_TASK",
      title: "Dời hạn nộp thẻ ST-9 sang thứ Sáu (30/10)?",
      description: "Thay đổi due_date từ 27/10 sang 30/10/2026. Kiểm tra Validator: Khả thi, không xung đột phụ thuộc.",
      payloadJson: {
        action: "UPDATE_DUE_DATE",
        taskCode: "ST-9",
        currentDueDate: "2026-10-27",
        proposedDueDate: "2026-10-30",
        reason: "Tạo khoảng trống tập trung hoàn thành cho An",
      },
      status: "pending",
      confirmLabel: "Đồng ý dời lịch",
      modifyLabel: "Chọn ngày khác",
    },
  },
];

export const CHAT_COMMAND_SUGGESTIONS = [
  { command: "/decompose", desc: "Phân rã yêu cầu thành danh sách công việc WBS" },
  { command: "/rebalance", desc: "Đề xuất cân bằng tải và tính lại độ chênh Spread" },
  { command: "/explain", desc: "Giải thích chi tiết 6 yếu tố gây điểm nguy cơ Burnout" },
];
