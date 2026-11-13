import { AppError } from "../lib/server/errors";
import { setupAccount } from "../lib/server/credentials";
import { database } from "../lib/server/database";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { readFileSync, statSync } from "node:fs";

async function main() {
  let username: string, password: string, names: string[];
  if (process.env.SETUP_PASSWORD_FILE) {
    const path = process.env.SETUP_PASSWORD_FILE;
    if (process.platform !== "win32" && statSync(path).mode & 0o077)
      throw new AppError("O arquivo da senha precisa ter permissões 600 ou 400.");
    password = readFileSync(path, "utf8").replace(/\r?\n$/, "");
    username = process.env.SETUP_USERNAME || "";
    names = [
      process.env.SETUP_PROFILE_1 || "",
      process.env.SETUP_PROFILE_2 || "",
    ];
  } else {
    if (!process.stdin.isTTY)
      throw new AppError(
        "Use um terminal interativo ou um arquivo secreto SETUP_PASSWORD_FILE.",
      );
    let muted = false;
    const output = new Writable({
      write(chunk, _encoding, callback) {
        if (!muted) process.stdout.write(chunk);
        callback();
      },
    });
    const rl = createInterface({
      input: process.stdin,
      output,
      terminal: true,
    });
    try {
      username = (await rl.question("Usuário compartilhado: ")).trim();
      process.stdout.write("Senha (mínimo 12 caracteres, entrada oculta): ");
      muted = true;
      password = await rl.question("");
      muted = false;
      process.stdout.write("\n");
      process.stdout.write("Repita a senha: ");
      muted = true;
      const confirmation = await rl.question("");
      muted = false;
      process.stdout.write("\n");
      if (password !== confirmation) throw new AppError("As senhas não conferem.");
      names = [
        (await rl.question("Nome do primeiro perfil: ")).trim(),
        (await rl.question("Nome do segundo perfil: ")).trim(),
      ];
    } finally {
      muted = false;
      rl.close();
    }
  }
  await setupAccount(username, password, names);
  console.log("Conta e dois perfis criados. Nenhuma senha foi registrada.");
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Não foi possível configurar a conta.",
    );
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      database().sqlite.close();
    } catch {}
  });
