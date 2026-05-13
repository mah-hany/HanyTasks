import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.role.findMany();
  console.log('Roles:', roles);
  
  const users = await prisma.user.findMany({ select: { username: true, roleId: true } });
  console.log('Users:', users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
