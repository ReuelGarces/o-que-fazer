import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { database } from "./database";
import { accounts, profiles, loginAttempts } from "./schema";
import { AppError } from "./errors";

export async function setupAccount(
  username: string,
  password: string,
  names: string[],
) {
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username))
    throw new AppError(
      "Usuário: 3 a 64 letras, números, ponto, hífen ou sublinhado.",
    );
  if (password.length < 12 || password.length > 256)
    throw new AppError("Use uma senha de 12 a 256 caracteres.");
  if (
    names.length !== 2 ||
    names.some((name) => !name.trim() || name.trim().length > 40)
  )
    throw new AppError("Configure exatamente dois nomes de até 40 caracteres.");
  const passwordHash = await hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  database().db.transaction(
    (tx) => {
      if (tx.select().from(accounts).get())
        throw new AppError(
          "A conta já foi configurada. O setup não altera contas existentes.",
        );
      const accountId = randomUUID();
      tx.insert(accounts)
        .values({
          id: accountId,
          username,
          passwordHash,
          createdAt: new Date().toISOString(),
        })
        .run();
      names.forEach((name, displayOrder) =>
        tx
          .insert(profiles)
          .values({
            id: randomUUID(),
            accountId,
            name: name.trim(),
            displayOrder,
            avatar: displayOrder ? "book" : "compass",
          })
          .run(),
      );
    },
    { behavior: "immediate" },
  );
}
// Shared persistent bucket: cannot be bypassed by spoofing forwarded IPs/usernames.
// A small self-hosted installation deliberately favors a bounded global limit.
export function reserveLoginAttempt(now = Date.now()) {
  database().db.transaction(
    (tx) => {
      const attempt = tx
        .select()
        .from(loginAttempts)
        .where(eq(loginAttempts.key, "login"))
        .get();
      if (attempt && attempt.resetAt > now && attempt.count >= 10)
        throw new AppError(
          "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
          429,
        );
      tx.insert(loginAttempts)
        .values({ key: "login", count: 1, resetAt: now + 15 * 60 * 1000 })
        .onConflictDoUpdate({
          target: loginAttempts.key,
          set: {
            count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1,
            resetAt:
              attempt && attempt.resetAt > now
                ? attempt.resetAt
                : now + 15 * 60 * 1000,
          },
        })
        .run();
    },
    { behavior: "immediate" },
  );
}
export async function authenticate(username: unknown, password: unknown) {
  reserveLoginAttempt();
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 64 ||
    password.length > 256
  )
    throw new AppError("Usuário ou senha inválidos.", 401);
  const account = database().db.select().from(accounts).get();
  // Always verify against the configured hash, including for unknown usernames.
  const valid = account ? await verify(account.passwordHash, password) : false;
  if (!account || !valid || account.username !== username)
    throw new AppError("Usuário ou senha inválidos.", 401);
  return account;
}
