import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProjectAccessService } from '../common/access/project-access.service';
import { WorkspaceAccessService } from '../common/access/workspace-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListTasksQueryDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

describe('TasksService.list (bộ lọc & thứ tự)', () => {
  let service: TasksService;

  const mockPrisma = {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const mockAccess = {
    assertRead: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: WorkspaceAccessService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('backlog=true: chỉ việc chưa vào sprint (sprintId=null) và sắp theo position phẳng', async () => {
    await service.list('user-1', 'project-1', { backlog: true });
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sprintId: null }),
        orderBy: [{ position: 'asc' }],
      }),
    );
  });

  it('không truyền backlog: giữ nguyên lọc theo cột, không ràng buộc sprintId', async () => {
    await service.list('user-1', 'project-1', {});
    const args = mockPrisma.task.findMany.mock.calls[0][0];
    expect(args.where).not.toHaveProperty('sprintId');
    expect(args.orderBy).toEqual([{ columnId: 'asc' }, { position: 'asc' }]);
  });

  it('sprintId: lọc đúng sprint đó (backlog không đè khi không truyền)', async () => {
    await service.list('user-1', 'project-1', { sprintId: 'sprint-1' });
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sprintId: 'sprint-1' }),
      }),
    );
  });

  it('backlog=true + sprintId cùng lúc: backlog thắng (khai báo rõ nghĩa)', async () => {
    await service.list('user-1', 'project-1', {
      sprintId: 'sprint-1',
      backlog: true,
    });
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sprintId: null }),
      }),
    );
  });
});

describe('ListTasksQueryDto.backlog (contract query param)', () => {
  it("chuỗi 'true' từ URL thành boolean true; không truyền thì undefined", () => {
    expect(
      plainToInstance(ListTasksQueryDto, { backlog: 'true' }).backlog,
    ).toBe(true);
    expect(
      plainToInstance(ListTasksQueryDto, { backlog: 'false' }).backlog,
    ).toBe(false);
    expect(plainToInstance(ListTasksQueryDto, {}).backlog).toBeUndefined();
  });

  it("đậu validate với 'true' (trước đây chỉ @IsString nên 'yes' cũng lọt)", () => {
    const dto = plainToInstance(ListTasksQueryDto, { backlog: 'true' });
    expect(validateSync(dto)).toEqual([]);
  });
});
