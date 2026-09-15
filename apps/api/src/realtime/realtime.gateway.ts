import { Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ProjectAccessService } from '../common/access/project-access.service';
import type { AccessPayload } from '../auth/auth.types';
import type { Env } from '../config/env.schema';
import { WsExceptionFilter } from './ws-exception.filter';

export interface SocketUser {
  id: string;
  email: string;
}

interface PresenceEntry {
  userId: string;
  view: string;
  at: number;
}

export const roomOfProject = (projectId: string): string =>
  `project:${projectId}`;
export const roomOfUser = (userId: string): string => `user:${userId}`;

/**
 * Cổng realtime (docs 01 §3, 11 §4). Client KHÔNG ghi qua socket — chỉ join phòng và nhận sự kiện;
 * mọi thay đổi đi qua REST rồi listener phát ra đây. Handshake mang access token trong `auth.token`.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UseFilters(WsExceptionFilter)
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  /** projectId → socketId → presence */
  private readonly presence = new Map<string, Map<string, PresenceEntry>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly access: ProjectAccessService,
  ) {}

  afterInit(): void {
    this.logger.log('Socket.io sẵn sàng');
  }

  /** Xác thực ngay khi kết nối; sai token → ngắt. Mỗi socket tự vào phòng user:{id}. */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.tokenOf(client);
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      const user: SocketUser = { id: payload.sub, email: payload.email };
      (client.data as { user?: SocketUser }).user = user;
      await client.join(roomOfUser(user.id));
      client.emit('connected', { userId: user.id, socketId: client.id });
    } catch {
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'Token không hợp lệ',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    for (const [projectId, sockets] of this.presence) {
      if (sockets.delete(client.id)) this.broadcastPresence(projectId);
    }
  }

  /** Join phòng dự án — kiểm quyền đọc theo dữ liệu; trả về danh sách ai đang xem. */
  @SubscribeMessage('project:join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId?: string; view?: string },
  ) {
    const user = this.userOf(client);
    const projectId = body?.projectId;
    if (!projectId)
      throw new WsException({
        code: 'VALIDATION_FAILED',
        message: 'Thiếu projectId',
      });
    try {
      await this.access.assertRead(user.id, projectId);
    } catch {
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Không có quyền xem dự án',
      });
    }
    await client.join(roomOfProject(projectId));
    this.setPresence(projectId, client.id, {
      userId: user.id,
      view: body.view ?? 'board',
      at: Date.now(),
    });
    this.broadcastPresence(projectId);
    return { ok: true, projectId, presence: this.presenceOf(projectId) };
  }

  @SubscribeMessage('project:leave')
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId?: string },
  ) {
    const projectId = body?.projectId;
    if (!projectId) return { ok: false };
    await client.leave(roomOfProject(projectId));
    this.presence.get(projectId)?.delete(client.id);
    this.broadcastPresence(projectId);
    return { ok: true };
  }

  @SubscribeMessage('presence:ping')
  ping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId?: string; view?: string },
  ) {
    const user = this.userOf(client);
    const projectId = body?.projectId;
    if (!projectId || !this.presence.get(projectId)?.has(client.id))
      return { ok: false };
    this.setPresence(projectId, client.id, {
      userId: user.id,
      view: body.view ?? 'board',
      at: Date.now(),
    });
    this.broadcastPresence(projectId);
    return { ok: true };
  }

  // ── Dùng bởi RealtimeListener ──

  toProject(projectId: string, event: string, payload: unknown): void {
    this.server?.to(roomOfProject(projectId)).emit(event, payload);
  }

  toUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(roomOfUser(userId)).emit(event, payload);
  }

  presenceOf(
    projectId: string,
  ): Array<{ userId: string; view: string; at: number }> {
    const byUser = new Map<string, PresenceEntry>();
    for (const e of this.presence.get(projectId)?.values() ?? []) {
      const cur = byUser.get(e.userId);
      if (!cur || cur.at < e.at) byUser.set(e.userId, e);
    }
    return [...byUser.values()].map((e) => ({
      userId: e.userId,
      view: e.view,
      at: e.at,
    }));
  }

  private setPresence(
    projectId: string,
    socketId: string,
    entry: PresenceEntry,
  ): void {
    if (!this.presence.has(projectId)) this.presence.set(projectId, new Map());
    this.presence.get(projectId)!.set(socketId, entry);
  }

  private broadcastPresence(projectId: string): void {
    this.toProject(projectId, 'presence:update', {
      projectId,
      users: this.presenceOf(projectId),
    });
  }

  private tokenOf(client: Socket): string {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer '))
      return header.slice(7);
    throw new Error('no token');
  }

  private userOf(client: Socket): SocketUser {
    const user = (client.data as { user?: SocketUser }).user;
    if (!user)
      throw new WsException({
        code: 'UNAUTHENTICATED',
        message: 'Chưa xác thực',
      });
    return user;
  }
}
