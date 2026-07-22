import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL se usa para migraciones (sin pooler); DATABASE_URL (pooled) para runtime
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
