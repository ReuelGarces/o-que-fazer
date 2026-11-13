import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, isAbsolute, resolve, relative } from "node:path";
import * as schema from "./schema";

export function openDatabase(filename: string) {
  if (!isAbsolute(filename))
    throw new Error(
      "SQLITE_PATH deve ser um caminho absoluto fora do repositório.",
    );
  const fromRepository = relative(process.cwd(), resolve(filename));
  if (!fromRepository.startsWith("..") && !isAbsolute(fromRepository))
    throw new Error("Guarde o banco fora do repositório.");
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const sqlite = new Database(filename);
  try {
    chmodSync(filename, 0o600);
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    return { db, sqlite };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
let connection: ReturnType<typeof openDatabase> | undefined;
export function database() {
  if (!connection) {
    if (!process.env.SQLITE_PATH)
      throw new Error("Configure SQLITE_PATH antes de iniciar.");
    connection = openDatabase(process.env.SQLITE_PATH);
  }
  return connection;
}
