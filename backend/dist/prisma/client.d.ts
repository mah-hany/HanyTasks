import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    log: {
        emit: "event";
        level: "error";
    }[];
}, "error", import("@prisma/client/runtime/library").DefaultArgs>;
export default prisma;
//# sourceMappingURL=client.d.ts.map