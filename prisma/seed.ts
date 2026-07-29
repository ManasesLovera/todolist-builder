import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: {
      email: "member@example.com",
      name: "Member User",
      passwordHash,
      role: "MEMBER",
    },
  });

  await prisma.todoList.create({
    data: {
      title: "Groceries",
      description: "Weekly shopping list",
      ownerId: member.id,
      items: {
        create: [
          { title: "Milk", position: 0 },
          { title: "Eggs", position: 1 },
          { title: "Bread", position: 2, isComplete: true },
        ],
      },
    },
  });

  await prisma.todoList.create({
    data: {
      title: "Work",
      description: "This week's tasks",
      ownerId: member.id,
      position: 1,
      items: {
        create: [
          { title: "Write status report", position: 0 },
          { title: "Review PRs", position: 1 },
        ],
      },
    },
  });

  console.log(`Seeded users: ${admin.email}, ${member.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
