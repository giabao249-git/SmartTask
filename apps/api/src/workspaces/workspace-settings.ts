import { z } from 'zod';

/**
 * Cài đặt workspace (JSON `workspaces.settings`) — mọi hằng số của công thức tải/burnout, lịch làm việc,
 * hạn mức AI và retention (docs/04-kien-truc/04 §0, 05 §7c). Giá trị mặc định là con số trong tài liệu.
 */
export const workspaceSettingsSchema = z.object({
  defaultCapacityHours: z.number().int().min(1).max(80).default(40),
  /** 1 = Thứ Hai … 7 = Chủ nhật */
  workdays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .default([1, 2, 3, 4, 5]),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  workHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .default({ start: '08:00', end: '17:30' }),
  adminOverhead: z.number().min(0).max(0.5).default(0.1),
  workload: z
    .object({
      thresholds: z
        .object({
          high: z.number().default(0.7),
          full: z.number().default(0.9),
          overload: z.number().default(1.1),
        })
        .default({}),
      ear: z
        .object({
          smoothingHours: z.number().default(20),
          windowWeeks: z.number().int().default(8),
        })
        .default({}),
      burnout: z
        .object({
          utilization: z.number().default(35),
          consecutiveWeeks: z.number().default(20),
          overdue: z.number().default(15),
          slowingDown: z.number().default(10),
          onTime: z.number().default(10),
          checkin: z.number().default(10),
          alertAt: z.number().default(70),
          watchAt: z.number().default(50),
        })
        .default({}),
      fairnessTarget: z.number().default(0.2),
    })
    .default({}),
  ai: z
    .object({
      dailyLimitPerUser: z.number().int().min(0).max(1000).default(20),
      enabledPurposes: z
        .array(z.enum(['DECOMPOSE', 'ASSIGN', 'EXPLAIN', 'CHAT']))
        .default(['DECOMPOSE', 'ASSIGN', 'EXPLAIN', 'CHAT']),
      behaviorSignals: z.boolean().default(false),
    })
    .default({}),
  retention: z
    .object({
      proposalDraftDays: z.number().int().default(7),
      proposalDoneDays: z.number().int().default(30),
      proposalAppliedDays: z.number().int().default(180),
      memoryProposedDays: z.number().int().default(7),
      chatMessageDays: z.number().int().default(90),
      notificationReadDays: z.number().int().default(90),
      refreshTokenDays: z.number().int().default(30),
    })
    .default({}),
});

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

/** PATCH nhận một phần; gộp sâu vào giá trị hiện có rồi validate lại toàn bộ. */
export const workspaceSettingsPatchSchema =
  workspaceSettingsSchema.deepPartial();

export function defaultWorkspaceSettings(): WorkspaceSettings {
  return workspaceSettingsSchema.parse({});
}

export function mergeSettings(
  current: unknown,
  patch: unknown,
): WorkspaceSettings {
  const base = workspaceSettingsSchema.parse(current ?? {});
  const merged = deepMerge(base, (patch ?? {}) as Record<string, unknown>);
  return workspaceSettingsSchema.parse(merged);
}

function deepMerge(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (isPlainObject(v) && isPlainObject(cur)) out[k] = deepMerge(cur, v);
    else out[k] = v;
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
