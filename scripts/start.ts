import { database } from "../lib/server/database";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
try {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new Error();
  const origin = new URL(process.env.APP_ORIGIN || "");
  if (origin.protocol !== "https:" || origin.origin !== process.env.APP_ORIGIN)
    throw new Error();
  database().sqlite.close();
  const child = spawn(
    process.execPath,
    [resolve("node_modules/next/dist/bin/next"), "start"],
    { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } },
  );
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  child.on("error", () => {
    console.error("Falha ao iniciar o Next.js.");
    process.exitCode = 1;
  });
} catch {
  console.error(
    "Inicialização interrompida. Confira SQLITE_PATH, SESSION_SECRET, APP_ORIGIN e permissões do volume.",
  );
  process.exitCode = 1;
}
