import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`SELECT photoPath FROM "UserProfile" LIMIT 1`);
    console.log("UserProfile HAS photoPath");
  } catch (e: any) {
    console.error("UserProfile missing photoPath:", e.message);
  }
}

main();
