import { guard, write } from "./common";
guard();
const {PrismaClient,Prisma}=await import("@prisma/client");
const client=new PrismaClient();
try{
  write("sqlite-runtime.json",{at:new Date().toISOString(),node:process.version,prisma:Prisma.prismaVersion,sqlite:await client.$queryRaw`SELECT sqlite_version() AS version`});
}finally{await client.$disconnect();}
