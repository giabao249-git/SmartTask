import { MEMBERS, type Member } from "./members";

export interface WorkloadWeek {
  weekKey: string; // W43, W44, W45, W46
  weekLabel: string; // 20/10–26/10
  utilization: number; // %
  effectiveLoad: number; // h
  effectiveCapacity: number; // h
  meetingHours: number; // h
  timeOffHours: number; // h
  taskCount: number;
}

export interface BurnoutFactor {
  name: string;
  weight: number; // max points (e.g. 35, 20, 15, 10, 10, 10)
  score: number;
  value: string;
  explanation: string;
}

export interface TruthSheetDay {
  date: string; // 24/10/2026
  dayOfWeek: string; // Thứ Năm
  baseHours: number; // 8h
  busyMeetings: { time: string; title: string; duration: number }[];
  plannedTasks: { code: string; title: string; hours: number }[];
  freeHours: number;
  focusBlocks: { start: string; end: string; duration: number }[]; // >= 2h
}

export interface MemberWorkloadDetail {
  memberId: string;
  member: Member;
  weeks: WorkloadWeek[];
  burnoutBreakdown: BurnoutFactor[];
  truthSheet: TruthSheetDay[];
}

export const WORKLOAD_DETAILS: MemberWorkloadDetail[] = [
  {
    memberId: "user-huy",
    member: MEMBERS.find((m) => m.id === "user-huy")!,
    weeks: [
      {
        weekKey: "W43",
        weekLabel: "20/10–26/10",
        utilization: 118,
        effectiveLoad: 47.2,
        effectiveCapacity: 40,
        meetingHours: 3,
        timeOffHours: 0,
        taskCount: 5,
      },
      {
        weekKey: "W44",
        weekLabel: "27/10–02/11",
        utilization: 105,
        effectiveLoad: 42.0,
        effectiveCapacity: 40,
        meetingHours: 4,
        timeOffHours: 0,
        taskCount: 4,
      },
      {
        weekKey: "W45",
        weekLabel: "03/11–09/11",
        utilization: 92,
        effectiveLoad: 36.8,
        effectiveCapacity: 40,
        meetingHours: 2,
        timeOffHours: 0,
        taskCount: 3,
      },
      {
        weekKey: "W46",
        weekLabel: "10/11–16/11",
        utilization: 65,
        effectiveLoad: 26.0,
        effectiveCapacity: 40,
        meetingHours: 3,
        timeOffHours: 0,
        taskCount: 2,
      },
    ],
    burnoutBreakdown: [
      {
        name: "Tải tuần hiện tại (U / 1.2)",
        weight: 35,
        score: 35,
        value: "118% (1.18)",
        explanation: "Tải tuần này vượt ngưỡng 110%, đạt mức tối đa 35 điểm trọng số.",
      },
      {
        name: "Chuỗi tuần quá tải liên tiếp",
        weight: 20,
        score: 13.3,
        value: "2 tuần liên tiếp > 90%",
        explanation: "Đã làm việc cường độ cao trong 2 tuần gần nhất (W42: 95%, W43: 118%).",
      },
      {
        name: "Tỷ lệ việc quá hạn / việc mở",
        weight: 15,
        score: 7.5,
        value: "2 / 4 việc (50%)",
        explanation: "ST-12 và ST-8 bị quá hạn so với kế hoạch ban đầu.",
      },
      {
        name: "Suy giảm vận tốc cá nhân (EAR)",
        weight: 10,
        score: 6.2,
        value: "EAR tăng từ 0.95 -> 1.15",
        explanation: "Thời gian thực tế bắt đầu vượt quá ước lượng do khối lượng dồn dập.",
      },
      {
        name: "Tỷ lệ không đúng hạn (1 - OnTime)",
        weight: 10,
        score: 7.0,
        value: "OnTime 70% (giảm từ 92%)",
        explanation: "Ghi nhận 3 task bị lùi due_date trong 4 tuần trượt.",
      },
      {
        name: "Check-in sức khoẻ / Phản hồi nhóm",
        weight: 10,
        score: 5.0,
        value: "Mức 2/5 (Cần hỗ trợ)",
        explanation: "Thành viên báo cáo cảm giác quá tải trong buổi standup thứ Hai.",
      },
    ],
    truthSheet: [
      {
        date: "24/10/2026",
        dayOfWeek: "Thứ Sáu",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 09:30", title: "Daily Sprint Standup", duration: 0.5 },
          { time: "14:00 - 15:00", title: "Review UI/UX với PM Lan", duration: 1.0 },
        ],
        plannedTasks: [
          { code: "ST-12", title: "Giao diện kéo thả Kanban", hours: 4.5 },
          { code: "ST-9", title: "Sheet bảng sự thật", hours: 2.0 },
        ],
        freeHours: 0,
        focusBlocks: [],
      },
      {
        date: "27/10/2026",
        dayOfWeek: "Thứ Hai",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 10:00", title: "Sprint Backlog Refinement", duration: 1.0 },
        ],
        plannedTasks: [
          { code: "ST-4", title: "Drawer Chat Trợ lý AI", hours: 4.0 },
        ],
        freeHours: 3.0,
        focusBlocks: [{ start: "14:00", end: "17:00", duration: 3.0 }],
      },
      {
        date: "28/10/2026",
        dayOfWeek: "Thứ Ba",
        baseHours: 8,
        busyMeetings: [],
        plannedTasks: [
          { code: "ST-4", title: "Drawer Chat Trợ lý AI (tiếp)", hours: 4.0 },
        ],
        freeHours: 4.0,
        focusBlocks: [{ start: "08:30", end: "12:00", duration: 3.5 }],
      },
      {
        date: "29/10/2026",
        dayOfWeek: "Thứ Tư",
        baseHours: 8,
        busyMeetings: [
          { time: "15:00 - 16:30", title: "Sprint 3 Demo & Review", duration: 1.5 },
        ],
        plannedTasks: [],
        freeHours: 6.5,
        focusBlocks: [{ start: "08:30", end: "12:00", duration: 3.5 }, { start: "13:00", end: "15:00", duration: 2.0 }],
      },
    ],
  },
  {
    memberId: "user-minh",
    member: MEMBERS.find((m) => m.id === "user-minh")!,
    weeks: [
      {
        weekKey: "W43",
        weekLabel: "20/10–26/10",
        utilization: 96,
        effectiveLoad: 38.4,
        effectiveCapacity: 40,
        meetingHours: 4,
        timeOffHours: 0,
        taskCount: 4,
      },
      {
        weekKey: "W44",
        weekLabel: "27/10–02/11",
        utilization: 98,
        effectiveLoad: 39.2,
        effectiveCapacity: 40,
        meetingHours: 4,
        timeOffHours: 0,
        taskCount: 4,
      },
      {
        weekKey: "W45",
        weekLabel: "03/11–09/11",
        utilization: 85,
        effectiveLoad: 34.0,
        effectiveCapacity: 40,
        meetingHours: 3,
        timeOffHours: 0,
        taskCount: 3,
      },
      {
        weekKey: "W46",
        weekLabel: "10/11–16/11",
        utilization: 70,
        effectiveLoad: 28.0,
        effectiveCapacity: 40,
        meetingHours: 3,
        timeOffHours: 0,
        taskCount: 2,
      },
    ],
    burnoutBreakdown: [
      {
        name: "Tải tuần hiện tại (U / 1.2)",
        weight: 35,
        score: 28,
        value: "96% (0.96)",
        explanation: "Tải ở mức Đầy (gần ngưỡng 100%), cần kiểm soát không để dồn việc thêm.",
      },
      {
        name: "Chuỗi tuần quá tải liên tiếp",
        weight: 20,
        score: 10,
        value: "1 tuần > 90%",
        explanation: "Mới chạm mức cao ở tuần hiện tại.",
      },
      {
        name: "Tỷ lệ việc quá hạn / việc mở",
        weight: 15,
        score: 0,
        value: "0 / 4 việc (0%)",
        explanation: "Các task backend đều đúng hạn và hoàn thành theo đúng tiến độ.",
      },
      {
        name: "Suy giảm vận tốc cá nhân (EAR)",
        weight: 10,
        score: 4.0,
        value: "EAR 1.02",
        explanation: "Ước lượng ổn định, chênh lệch thực tế và kế hoạch dưới 5%.",
      },
      {
        name: "Tỷ lệ không đúng hạn (1 - OnTime)",
        weight: 10,
        score: 4.0,
        value: "OnTime 88%",
        explanation: "Tỷ lệ giao việc đúng hạn duy trì ở mức cao.",
      },
      {
        name: "Check-in sức khoẻ / Phản hồi nhóm",
        weight: 10,
        score: 6.0,
        value: "Mức 3/5",
        explanation: "Tập trung cao độ cho bài toán indexing dữ liệu lớn.",
      },
    ],
    truthSheet: [
      {
        date: "24/10/2026",
        dayOfWeek: "Thứ Sáu",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 09:30", title: "Daily Sprint Standup", duration: 0.5 },
        ],
        plannedTasks: [
          { code: "ST-7", title: "Index PostgreSQL", hours: 5.5 },
          { code: "ST-14", title: "JWT Auth", hours: 2.0 },
        ],
        freeHours: 0,
        focusBlocks: [],
      },
      {
        date: "27/10/2026",
        dayOfWeek: "Thứ Hai",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 10:00", title: "Sprint Backlog Refinement", duration: 1.0 },
        ],
        plannedTasks: [
          { code: "ST-1", title: "Thuật toán chia tải EffLoad", hours: 6.0 },
        ],
        freeHours: 1.0,
        focusBlocks: [],
      },
      {
        date: "28/10/2026",
        dayOfWeek: "Thứ Ba",
        baseHours: 8,
        busyMeetings: [],
        plannedTasks: [
          { code: "ST-1", title: "Thuật toán chia tải EffLoad (tiếp)", hours: 6.0 },
        ],
        freeHours: 2.0,
        focusBlocks: [{ start: "14:00", end: "16:00", duration: 2.0 }],
      },
      {
        date: "29/10/2026",
        dayOfWeek: "Thứ Tư",
        baseHours: 8,
        busyMeetings: [
          { time: "15:00 - 16:30", title: "Sprint 3 Demo & Review", duration: 1.5 },
        ],
        plannedTasks: [],
        freeHours: 6.5,
        focusBlocks: [{ start: "08:30", end: "12:00", duration: 3.5 }],
      },
    ],
  },
  {
    memberId: "user-lan",
    member: MEMBERS.find((m) => m.id === "user-lan")!,
    weeks: [
      {
        weekKey: "W43",
        weekLabel: "20/10–26/10",
        utilization: 62,
        effectiveLoad: 24.8,
        effectiveCapacity: 40,
        meetingHours: 8,
        timeOffHours: 0,
        taskCount: 3,
      },
      {
        weekKey: "W44",
        weekLabel: "27/10–02/11",
        utilization: 65,
        effectiveLoad: 26.0,
        effectiveCapacity: 40,
        meetingHours: 7,
        timeOffHours: 0,
        taskCount: 3,
      },
      {
        weekKey: "W45",
        weekLabel: "03/11–09/11",
        utilization: 60,
        effectiveLoad: 24.0,
        effectiveCapacity: 40,
        meetingHours: 6,
        timeOffHours: 0,
        taskCount: 2,
      },
      {
        weekKey: "W46",
        weekLabel: "10/11–16/11",
        utilization: 50,
        effectiveLoad: 20.0,
        effectiveCapacity: 40,
        meetingHours: 5,
        timeOffHours: 0,
        taskCount: 2,
      },
    ],
    burnoutBreakdown: [
      {
        name: "Tải tuần hiện tại (U / 1.2)",
        weight: 35,
        score: 18.1,
        value: "62% (0.62)",
        explanation: "Tải tối ưu trong ngưỡng xanh an toàn.",
      },
      {
        name: "Chuỗi tuần quá tải liên tiếp",
        weight: 20,
        score: 0,
        value: "0 tuần",
        explanation: "Không ghi nhận giai đoạn vượt ngưỡng.",
      },
      {
        name: "Tỷ lệ việc quá hạn / việc mở",
        weight: 15,
        score: 0,
        value: "0%",
        explanation: "Không có task quản trị quá hạn.",
      },
      {
        name: "Suy giảm vận tốc cá nhân (EAR)",
        weight: 10,
        score: 3.5,
        value: "EAR 1.05",
        explanation: "Tốc độ hoàn thành công việc ổn định.",
      },
      {
        name: "Tỷ lệ không đúng hạn (1 - OnTime)",
        weight: 10,
        score: 2.4,
        value: "OnTime 95%",
        explanation: "Kỷ luật quản lý mốc thời gian chặt chẽ.",
      },
      {
        name: "Check-in sức khoẻ / Phản hồi nhóm",
        weight: 10,
        score: 10.0,
        value: "Mức 4/5 (Rất tốt)",
        explanation: "Trạng thái tinh thần và năng lượng làm việc tích cực.",
      },
    ],
    truthSheet: [
      {
        date: "24/10/2026",
        dayOfWeek: "Thứ Sáu",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 09:30", title: "Daily Sprint Standup", duration: 0.5 },
          { time: "14:00 - 15:00", title: "Review UI/UX với Huy", duration: 1.0 },
        ],
        plannedTasks: [
          { code: "ST-11", title: "AI Agent Prompt WBS", hours: 2.0 },
        ],
        freeHours: 4.5,
        focusBlocks: [{ start: "10:00", end: "12:00", duration: 2.0 }, { start: "15:00", end: "17:30", duration: 2.5 }],
      },
    ],
  },
  {
    memberId: "user-thao",
    member: MEMBERS.find((m) => m.id === "user-thao")!,
    weeks: [
      {
        weekKey: "W43",
        weekLabel: "20/10–26/10",
        utilization: 45,
        effectiveLoad: 18.0,
        effectiveCapacity: 40,
        meetingHours: 4,
        timeOffHours: 0,
        taskCount: 3,
      },
      {
        weekKey: "W44",
        weekLabel: "27/10–02/11",
        utilization: 55,
        effectiveLoad: 22.0,
        effectiveCapacity: 40,
        meetingHours: 4,
        timeOffHours: 0,
        taskCount: 3,
      },
      {
        weekKey: "W45",
        weekLabel: "03/11–09/11",
        utilization: 50,
        effectiveLoad: 20.0,
        effectiveCapacity: 40,
        meetingHours: 3,
        timeOffHours: 0,
        taskCount: 2,
      },
      {
        weekKey: "W46",
        weekLabel: "10/11–16/11",
        utilization: 40,
        effectiveLoad: 16.0,
        effectiveCapacity: 40,
        meetingHours: 2,
        timeOffHours: 0,
        taskCount: 2,
      },
    ],
    burnoutBreakdown: [
      {
        name: "Tải tuần hiện tại (U / 1.2)",
        weight: 35,
        score: 13.1,
        value: "45% (0.45)",
        explanation: "Mức tải nhẹ, sẵn sàng nhận thêm việc kiểm thử tự động.",
      },
      {
        name: "Chuỗi tuần quá tải liên tiếp",
        weight: 20,
        score: 0,
        value: "0 tuần",
        explanation: "Không có áp lực dồn việc.",
      },
      {
        name: "Tỷ lệ việc quá hạn / việc mở",
        weight: 15,
        score: 0,
        value: "0%",
        explanation: "Không có lỗi kiểm thử chậm trễ.",
      },
      {
        name: "Suy giảm vận tốc cá nhân (EAR)",
        weight: 10,
        score: 3.0,
        value: "EAR 0.98",
        explanation: "Tiến độ viết test case nhanh hơn dự tính.",
      },
      {
        name: "Tỷ lệ không đúng hạn (1 - OnTime)",
        weight: 10,
        score: 2.0,
        value: "OnTime 96%",
        explanation: "Giao việc đúng hạn.",
      },
      {
        name: "Check-in sức khoẻ / Phản hồi nhóm",
        weight: 10,
        score: 9.9,
        value: "Mức 5/5 (Thoải mái)",
        explanation: "Cân bằng công việc tốt.",
      },
    ],
    truthSheet: [
      {
        date: "24/10/2026",
        dayOfWeek: "Thứ Sáu",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 09:30", title: "Daily Sprint Standup", duration: 0.5 },
        ],
        plannedTasks: [
          { code: "ST-17", title: "Kiểm thử API AI Decompose", hours: 3.0 },
        ],
        freeHours: 4.5,
        focusBlocks: [{ start: "10:00", end: "12:00", duration: 2.0 }, { start: "13:30", end: "16:00", duration: 2.5 }],
      },
    ],
  },
  {
    memberId: "user-an",
    member: MEMBERS.find((m) => m.id === "user-an")!,
    weeks: [
      {
        weekKey: "W43",
        weekLabel: "20/10–26/10",
        utilization: 30,
        effectiveLoad: 12.0,
        effectiveCapacity: 40,
        meetingHours: 2,
        timeOffHours: 0,
        taskCount: 2,
      },
      {
        weekKey: "W44",
        weekLabel: "27/10–02/11",
        utilization: 40,
        effectiveLoad: 16.0,
        effectiveCapacity: 40,
        meetingHours: 2,
        timeOffHours: 0,
        taskCount: 2,
      },
      {
        weekKey: "W45",
        weekLabel: "03/11–09/11",
        utilization: 45,
        effectiveLoad: 18.0,
        effectiveCapacity: 40,
        meetingHours: 2,
        timeOffHours: 0,
        taskCount: 2,
      },
      {
        weekKey: "W46",
        weekLabel: "10/11–16/11",
        utilization: 35,
        effectiveLoad: 14.0,
        effectiveCapacity: 40,
        meetingHours: 2,
        timeOffHours: 0,
        taskCount: 1,
      },
    ],
    burnoutBreakdown: [
      {
        name: "Tải tuần hiện tại (U / 1.2)",
        weight: 35,
        score: 8.75,
        value: "30% (0.30)",
        explanation: "Thành viên mới gia nhập, khối lượng công việc hiện thấp hơn năng lực 70%.",
      },
      {
        name: "Chuỗi tuần quá tải liên tiếp",
        weight: 20,
        score: 0,
        value: "0 tuần",
        explanation: "Không có.",
      },
      {
        name: "Tỷ lệ việc quá hạn / việc mở",
        weight: 15,
        score: 0,
        value: "0%",
        explanation: "Hoàn thành tốt ST-18.",
      },
      {
        name: "Suy giảm vận tốc cá nhân (EAR)",
        weight: 10,
        score: 4.25,
        value: "EAR 1.0 (mặc định Bayes)",
        explanation: "Mới làm ít hơn 5 task nên áp dụng trọng số khởi tạo Bayes.",
      },
      {
        name: "Tỷ lệ không đúng hạn (1 - OnTime)",
        weight: 10,
        score: 2.0,
        value: "OnTime 100%",
        explanation: "Đúng hạn.",
      },
      {
        name: "Check-in sức khoẻ / Phản hồi nhóm",
        weight: 10,
        score: 7.0,
        value: "Mức 4/5",
        explanation: "Sẵn sàng hỗ trợ Huy gánh bớt task frontend/fullstack.",
      },
    ],
    truthSheet: [
      {
        date: "24/10/2026",
        dayOfWeek: "Thứ Sáu",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 09:30", title: "Daily Sprint Standup", duration: 0.5 },
        ],
        plannedTasks: [
          { code: "ST-18", title: "Sửa Avatar fallback", hours: 2.0 },
        ],
        freeHours: 5.5,
        focusBlocks: [{ start: "10:00", end: "12:00", duration: 2.0 }, { start: "13:30", end: "17:00", duration: 3.5 }],
      },
      {
        date: "27/10/2026",
        dayOfWeek: "Thứ Hai",
        baseHours: 8,
        busyMeetings: [
          { time: "09:00 - 10:00", title: "Sprint Backlog Refinement", duration: 1.0 },
        ],
        plannedTasks: [],
        freeHours: 7.0,
        focusBlocks: [{ start: "10:00", end: "12:00", duration: 2.0 }, { start: "13:00", end: "17:30", duration: 4.5 }],
      },
    ],
  },
];
