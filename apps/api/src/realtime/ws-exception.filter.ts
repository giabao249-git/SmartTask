import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

/** Lỗi trong handler socket trả về client qua ack dạng { error: { code, message } } thay vì ngắt kết nối. */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const ack = host
      .getArgs()
      .find((a): a is (r: unknown) => void => typeof a === 'function');
    let body: object = { code: 'INTERNAL', message: 'Lỗi hệ thống' };
    if (exception instanceof WsException) {
      const err: unknown = exception.getError();
      body =
        typeof err === 'object' && err !== null
          ? err
          : {
              code: 'WS_ERROR',
              message: typeof err === 'string' ? err : 'Lỗi',
            };
    }
    if (ack) ack({ error: body });
    else client.emit('error', body);
  }
}
