import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceLifecycleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminService } from './admin.service';
import { PlatformStateService } from './platform-state.service';

describe('AdminService', () => {
  let service: AdminService;
  let stored: { key: string; value: unknown } | null = null;

  const mockPrisma = {
    workspace: {
      count: jest.fn().mockResolvedValue(10),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      count: jest.fn().mockResolvedValue(50),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    task: {
      count: jest.fn().mockResolvedValue(100),
    },
    aiTokenLog: {
      aggregate: jest.fn().mockResolvedValue({
        _count: 500,
        _sum: {
          totalTokens: 150000,
          inputTokens: 100000,
          outputTokens: 50000,
          estimatedCost: 0.45,
        },
      }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    systemAuditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'log-1', ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    refreshToken: {
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    // Giả lập bảng platform_settings có trạng thái để kiểm tra bảo trì lưu và đọc lại được
    platformSetting: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: { value: unknown } }) => {
          stored = create as typeof stored;
          return Promise.resolve(stored);
        }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('test_jwt_secret'),
  };

  beforeEach(async () => {
    stored = null;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        AdminAuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        PlatformStateService,
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should calculate platform stats correctly', async () => {
    const stats = await service.getPlatformStats();
    expect(stats.workspaces.total).toBe(10);
    expect(stats.users.total).toBe(50);
    expect(stats.tasks.total).toBe(100);
    expect(stats.aiFinOps.totalTokens).toBe(150000);
    expect(stats.maintenance.mode).toBe('DISABLED');
  });

  it('should update workspace status with audit log', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      id: 'ws-123',
      name: 'Acme Corp',
      status: WorkspaceLifecycleStatus.ACTIVE,
      suspendedAt: null,
      suspendReason: null,
    });

    mockPrisma.workspace.update.mockResolvedValueOnce({
      id: 'ws-123',
      name: 'Acme Corp',
      status: WorkspaceLifecycleStatus.SOFT_SUSPENDED,
      suspendedAt: new Date(),
      suspendReason: 'Quá hạn thanh toán',
    });

    const result = await service.updateWorkspaceStatus(
      'ws-123',
      {
        status: WorkspaceLifecycleStatus.SOFT_SUSPENDED,
        reason: 'Quá hạn thanh toán',
      },
      { id: 'admin-1', email: 'admin@smarttask.vn' },
      '127.0.0.1',
      'Jest Test Agent',
    );

    expect(result.status).toBe(WorkspaceLifecycleStatus.SOFT_SUSPENDED);
    expect(result.suspendReason).toBe('Quá hạn thanh toán');
    expect(mockPrisma.workspace.update).toHaveBeenCalled();
  });

  it('should toggle maintenance mode and preserve state', async () => {
    const result = await service.setMaintenanceMode(
      {
        mode: 'READ_ONLY',
        reason: 'Nâng cấp bảo trì DB',
        expectedDurationMinutes: 45,
      },
      { id: 'admin-1', email: 'admin@smarttask.vn' },
    );

    expect(result.mode).toBe('READ_ONLY');
    expect(result.reason).toBe('Nâng cấp bảo trì DB');
    expect(result.expectedDurationMinutes).toBe(45);

    const telemetry = await service.getSystemTelemetry();
    expect(telemetry.maintenance.mode).toBe('READ_ONLY');
    expect(telemetry.database.status).toBe('CONNECTED');
  });

  it('should reject self-demotion when an admin attempts to strip their own super admin rights', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@smarttask.vn',
      isSuperAdmin: true,
      platformRole: 'SUPER_ADMIN',
    });

    await expect(
      service.updateUserPlatformRole(
        'admin-1',
        { isSuperAdmin: false, platformRole: null, reason: 'Tự hạ quyền' },
        { id: 'admin-1', email: 'admin@smarttask.vn' },
      ),
    ).rejects.toThrow(
      'Bạn không thể tự tước quyền quản trị tối cao của chính mình',
    );
  });

  it('should revoke all user sessions and write audit trail', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'target-user-99',
      email: 'rogue@smarttask.vn',
    });

    const res = await service.revokeUserSessions(
      'target-user-99',
      { id: 'admin-1', email: 'admin@smarttask.vn' },
      '127.0.0.1',
      'Test Agent',
    );

    expect(res.message).toContain('Đã thu hồi thành công');
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'target-user-99' },
    });
  });
});
