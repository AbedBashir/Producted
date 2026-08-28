import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

// Uses the driver-adapter (JS `mariadb` driver) instead of Prisma's native Rust
// query engine. Some process-managed hosts (e.g. Hostinger/cPanel's Node.js app
// manager) suspend and resume the Node process between requests in a way that
// corrupts the Rust engine's internal tokio timers, crashing every query with
// `PrismaClientRustPanicError: PANIC: timer has gone away`. The driver adapter
// runs queries through the pure-JS `mariadb` client instead, so there's no
// native timer to break.
//
// connectTimeout is set explicitly (as a connection-string param, since the
// adapter only forwards the string itself to the underlying `mariadb` pool —
// not its second constructor argument) because "localhost" in DATABASE_URL
// can resolve to the IPv6 loopback (::1) first on some hosts; if MySQL is
// only bound to 127.0.0.1, that attempt can hang far longer than expected
// with no error surfaced anywhere, which looks like a stuck/blank app rather
// than a failure. Prefer 127.0.0.1 explicitly in DATABASE_URL to avoid this
// outright — this timeout just makes it fail loudly instead of hanging if it
// recurs.
function withConnectTimeout(databaseUrl: string): string {
  if (!databaseUrl || /[?&]connectTimeout=/.test(databaseUrl)) {
    return databaseUrl;
  }
  const separator = databaseUrl.includes("?") ? "&" : "?";
  return `${databaseUrl}${separator}connectTimeout=10000`;
}

const adapter = new PrismaMariaDb(
  withConnectTimeout(process.env.DATABASE_URL || ""),
);

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
