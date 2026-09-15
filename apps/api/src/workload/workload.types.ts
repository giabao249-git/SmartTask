import type { WorkloadLevel } from '@prisma/client';

export interface TaskContribution {
  taskId: string;
  key: string;
  title: string;
  projectId: string;
  remainingHours: number;
  share: number;
  hoursInWeek: number;
  hoursEff: number;
  factors: { ear: number; difficulty: number; skillGap: number };
  overdue: boolean;
  dueDate: string | null;
}

export interface WeekLoad {
  weekStart: string;
  loadHours: number;
  effLoadHours: number;
  capacityHours: number;
  effCapacityHours: number;
  meetingHours: number;
  timeOffHours: number;
  utilization: number;
  level: WorkloadLevel;
  riskScore: number;
  riskLabel: 'NORMAL' | 'WATCH' | 'BURNOUT_RISK';
  riskBreakdown: Record<string, number>;
  switchPenalty: number;
  projectsOpen: number;
  tasks: TaskContribution[];
}

export interface UserWorkload {
  userId: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
  weeks: WeekLoad[];
}

export interface DayFree {
  date: string;
  freeHours: number;
  busyHours: number;
  plannedHours: number;
  focusBlocks: number;
  isWorkday: boolean;
}
