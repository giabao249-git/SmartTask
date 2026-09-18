export interface RebalanceAction {
  id: string;
  taskCode: string;
  taskTitle: string;
  hours: number;
  fromUser: { id: string; name: string; role: string; beforeLoad: number; afterLoad: number };
  toUser: { id: string; name: string; role: string; beforeLoad: number; afterLoad: number };
  rationale: string;
  skillMatch: string;
  applied: boolean;
}

export interface RebalanceProposal {
  id: string;
  title: string;
  createdAt: string;
  spreadBefore: number; // 41%
  spreadAfter: number; // 18%
  overloadCountBefore: number; // 1 (Huy 118%)
  overloadCountAfter: number; // 0
  recommendations: RebalanceAction[];
  summary: string;
}

export const CURRENT_REBALANCE_PROPOSAL: RebalanceProposal = {
  id: "reb-prop-01",
  title: "Đề xuất cân bằng tải Sprint 3: Giảm áp lực cho Huy (Frontend)",
  createdAt: "Hôm nay, 08:30",
  spreadBefore: 41,
  spreadAfter: 18,
  overloadCountBefore: 1,
  overloadCountAfter: 0,
  summary: "Huy hiện đang gánh 118% tải tuần với 2 task quá hạn. Chuyển bớt 2 công việc phù hợp năng lực sang An (đang 30%) giúp đưa Spread tải của toàn đội từ 41% về 18% (đạt mục tiêu chuẩn ≤ 20%).",
  recommendations: [
    {
      id: "act-1",
      taskCode: "ST-16",
      taskTitle: "Bổ sung Ma trận Eisenhower phân loại 4 góc phần tư",
      hours: 6,
      fromUser: { id: "user-huy", name: "Huy", role: "Frontend", beforeLoad: 118, afterLoad: 103 },
      toUser: { id: "user-an", name: "An", role: "Fullstack", beforeLoad: 30, afterLoad: 45 },
      rationale: "Task thuần UI độc lập không ảnh hưởng luồng core của Sprint. An có kỹ năng React 2/5 hoàn toàn đảm nhận tốt.",
      skillMatch: "Đạt yêu cầu (React 2/2, TypeScript 2/2)",
      applied: false,
    },
    {
      id: "act-2",
      taskCode: "ST-9",
      taskTitle: "Xây dựng Sheet bảng sự thật chi tiết tải giờ trống và focus block",
      hours: 10,
      fromUser: { id: "user-huy", name: "Huy", role: "Frontend", beforeLoad: 103, afterLoad: 88 },
      toUser: { id: "user-an", name: "An", role: "Fullstack", beforeLoad: 45, afterLoad: 68 },
      rationale: "Chuyển giao giúp Huy hạ tải về mức 88% (an toàn), đồng thời tạo cơ hội cho An tiếp cận component Radix Sheet của SmartTask.",
      skillMatch: "Đạt yêu cầu (React 2/3, Huy hỗ trợ review)",
      applied: false,
    },
  ],
};
