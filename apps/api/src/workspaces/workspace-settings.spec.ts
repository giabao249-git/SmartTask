import {
  defaultWorkspaceSettings,
  mergeSettings,
  workspaceSettingsPatchSchema,
} from './workspace-settings';

describe('workspace settings', () => {
  it('mặc định đúng con số trong tài liệu 04', () => {
    const s = defaultWorkspaceSettings();
    expect(s.defaultCapacityHours).toBe(40);
    expect(s.workload.thresholds).toEqual({
      high: 0.7,
      full: 0.9,
      overload: 1.1,
    });
    expect(s.workload.burnout.alertAt).toBe(70);
    expect(s.ai.dailyLimitPerUser).toBe(20);
    expect(s.retention.proposalDraftDays).toBe(7);
  });

  it('gộp sâu: chỉ đổi trường được gửi, giữ nguyên phần còn lại', () => {
    const cur = defaultWorkspaceSettings();
    const merged = mergeSettings(cur, {
      workload: { thresholds: { overload: 1.2 } },
      ai: { dailyLimitPerUser: 5 },
    });
    expect(merged.workload.thresholds).toEqual({
      high: 0.7,
      full: 0.9,
      overload: 1.2,
    });
    expect(merged.workload.burnout.alertAt).toBe(70);
    expect(merged.ai.dailyLimitPerUser).toBe(5);
    expect(merged.workdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('mảng thay thế toàn bộ, không gộp phần tử', () => {
    const merged = mergeSettings(defaultWorkspaceSettings(), {
      workdays: [1, 2, 3, 4, 5, 6],
    });
    expect(merged.workdays).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('giá trị sai kiểu bị từ chối ở schema patch', () => {
    expect(
      workspaceSettingsPatchSchema.safeParse({ workdays: [8] }).success,
    ).toBe(false);
    expect(
      workspaceSettingsPatchSchema.safeParse({ holidays: ['2026-13-01x'] })
        .success,
    ).toBe(false);
    expect(() => mergeSettings({}, { defaultCapacityHours: 500 })).toThrow();
  });
});
