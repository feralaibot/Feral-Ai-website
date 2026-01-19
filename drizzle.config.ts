import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const shouldRequireSsl = process.env.PGSSL === "true";
const rawUrl = process.env.DATABASE_URL;
const dbUrl = (() => {
  if (!shouldRequireSsl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.get("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}sslmode=require`;
  }
})();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
