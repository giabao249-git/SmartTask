import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let logsStore: any[] = [];

  const mockPrisma = {
    systemAuditLog: {
      findFirst: jest.fn().mockImplementation(() => {
        if (logsStore.length === 0) return Promise.resolve(null);
        return Promise.resolve(logsStore[logsStore.length - 1]);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const record = { id: `log-${logsStore.length + 1}`, ...data };
        logsStore.push(record);
        return Promise.resolve(record);
      }),
      findMany: jest
        .fn()
        .mockImplementation(() => Promise.resolve([...logsStore])),
      count: jest
        .fn()
        .mockImplementation(() => Promise.resolve(logsStore.length)),
    },
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('test_hmac_secret_key_12345'),
  };

  beforeEach(async () => {
    logsStore = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
  });

  it('should create audit logs with valid HMAC chaining', async () => {
    const log1 = await service.log({
      actorId: 'usr-1',
      actorEmail: 'admin1@smarttask.vn',
      action: 'UPDATE_WORKSPACE',
      targetType: 'Workspace',
      targetId: 'ws-1',
      reason: 'Đổi tên công ty',
    });

    expect(log1).toBeDefined();
    expect(log1?.previousHash).toBe(
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
    expect(log1?.currentHash).toHaveLength(64);

    const log2 = await service.log({
      actorId: 'usr-2',
      actorEmail: 'admin2@smarttask.vn',
      action: 'SUSPEND_WORKSPACE',
      targetType: 'Workspace',
      targetId: 'ws-2',
      reason: 'Gian lận thẻ thanh toán',
    });

    expect(log2?.previousHash).toBe(log1?.currentHash);

    const integrity = await service.verifyIntegrity(50);
    expect(integrity.isCompromised).toBe(false);
    expect(integrity.verifiedCount).toBe(2);
  });

  it('should detect tampering if hash chain is broken', async () => {
    await service.log({
      actorId: 'usr-1',
      action: 'ACTION_1',
      targetType: 'Workspace',
      targetId: 'ws-1',
    });

    await service.log({
      actorId: 'usr-2',
      action: 'ACTION_2',
      targetType: 'Workspace',
      targetId: 'ws-2',
    });

    // Tamper with record 2's previousHash
    logsStore[1].previousHash =
      'tampered_fake_hash_1234567890abcdef1234567890abcdef1234567890abcdef';

    const integrity = await service.verifyIntegrity(50);
    expect(integrity.isCompromised).toBe(true);
    expect(integrity.brokenAtId).toBe('log-2');
    expect(integrity.compromiseReason).toBe('BROKEN_CHAIN_LINK');
  });

  it('should detect payload tampering when record reason or action is modified', async () => {
    await service.log({
      actorId: 'usr-1',
      action: 'SUSPEND_WORKSPACE',
      targetType: 'Workspace',
      targetId: 'ws-1',
      reason: 'Vi phạm chính sách thanh toán nghiêm trọng',
    });

    // An attacker directly modifies the database field 'reason'
    logsStore[0].reason = 'Tẩy xóa lý do đình chỉ';

    const integrity = await service.verifyIntegrity(50);
    expect(integrity.isCompromised).toBe(true);
    expect(integrity.brokenAtId).toBe('log-1');
    expect(integrity.compromiseReason).toBe('PAYLOAD_TAMPERED');
  });
});
