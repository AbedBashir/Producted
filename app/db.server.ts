import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

// Uses the driver-adapter (JS `mariadb` driver) instead of Prisma's native Rust
// query engine. Some process-managed hosts (e.g. Hostinger/cPanel's Node.js app
// manager) suspend and resume the Node process between requests in a way that
// corrupts the Rust engine's internal tokio timers, crashing every query with
// `PrismaClientRustPanicError: PANIC: timer has gone away`. The driver adapter
// runs queries through the pure-JS `mariadb` client instead, so there's no
// native timer to break.
const adapter = new PrismaMariaDb(process.env.DATABASE_URL || "");

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({ adapter });
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient({ adapter });

export default prisma;
