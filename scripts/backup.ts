import { database } from "../lib/server/database";
import { chmodSync, existsSync } from "node:fs";
import { isAbsolute } from "node:path";
async function main() {
  const destination = process.env.SQLITE_BACKUP_PATH;
  if (!destination || !isAbsolute(destination) || existsSync(destination))
    throw new Error();
  await database().sqlite.backup(destination);
  chmodSync(destination, 0o600);
  console.log("Backup SQLite consistente concluído.");
}
main()
  .catch(() => {
    console.error(
      "Falha no backup. Configure SQLITE_BACKUP_PATH absoluto, novo e com diretório gravável.",
    );
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      database().sqlite.close();
    } catch {}
  });
