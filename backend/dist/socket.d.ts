import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
export declare const userSocketMap: Map<number, string>;
export declare function initSocket(httpServer: HttpServer): void;
export declare function getSocketIO(): SocketServer;
export declare function emitToUser(userId: number, event: string, data: any): void;
export declare function emitToAll(event: string, data: any): void;
//# sourceMappingURL=socket.d.ts.map