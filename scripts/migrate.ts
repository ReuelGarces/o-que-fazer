import { database } from "../lib/server/database";
try {
  database().sqlite.close();
  console.log(
    "Migrações aplicadas. Volume SQLite acessível para leitura e escrita.",
  );
} catch {
  console.error(
    "Falha ao migrar. Confira SQLITE_PATH, montagem do volume e permissões.",
  );
  process.exitCode = 1;
}
