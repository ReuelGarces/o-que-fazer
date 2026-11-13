import Database from "better-sqlite3";
import { chmodSync, closeSync, openSync, unlinkSync, mkdirSync, readdirSync, lstatSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

async function main() {
  process.umask(0o077);
  const source = process.env.SQLITE_PATH;
  const directory = process.env.SQLITE_BACKUP_DIR;
  const keep = Number(process.env.SQLITE_BACKUP_KEEP ?? "14");
  if (!source || !isAbsolute(source) || !Number.isInteger(keep) || keep < 1) throw new Error();
  if (directory && !isAbsolute(directory)) throw new Error();
  if (directory) mkdirSync(directory, { recursive: true, mode: 0o700 });
  const destination = process.env.SQLITE_BACKUP_PATH ?? (directory
    ? join(directory, `oqf-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.sqlite`) : undefined);
  if (!destination || !isAbsolute(destination) || resolve(destination) === resolve(source)) throw new Error();
  // Exclusive creation prevents overwriting an existing file or following a symlink.
  closeSync(openSync(destination, "wx", 0o600));
  let sqlite: Database.Database | undefined;
  let complete = false;
  try {
    sqlite = new Database(source, { readonly: true, fileMustExist: true });
    await sqlite.backup(destination);
    const check = new Database(destination, { fileMustExist: true });
    try {
      if (check.pragma("integrity_check", { simple: true }) !== "ok") throw new Error();
      // Make the standalone snapshot independent of WAL/SHM sidecars.
      check.pragma("journal_mode = DELETE");
    }
    finally { check.close(); }
    chmodSync(destination, 0o600);
    complete = true;
    if (directory && !process.env.SQLITE_BACKUP_PATH) {
      const files = readdirSync(directory).filter(name => /^oqf-\d{4}-.*-[0-9a-f-]{36}\.sqlite$/.test(name))
        .filter(name => lstatSync(join(directory, name)).isFile()).sort().reverse();
      for (const name of files.slice(keep)) unlinkSync(join(directory, name));
    }
    console.log("Backup SQLite consistente concluído.");
  } finally {
    sqlite?.close();
    if (!complete) unlinkSync(destination);
  }
}
main().catch(() => {
  console.error("Falha no backup. Confira origem existente, destino novo, retenção e permissões.");
  process.exitCode = 1;
});
