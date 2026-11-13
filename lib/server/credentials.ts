import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { randomUUID, createHmac } from "node:crypto";
import { eq, lte } from "drizzle-orm";
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
// No client IP headers are trusted. HMAC prevents storing attempted passwords.
export function reserveLoginAttempt(key: string, now = Date.now()) {
  database().db.transaction((tx) => {
    tx.delete(loginAttempts).where(lte(loginAttempts.resetAt, now)).run();
    for (const [bucket, limit, window] of [
      ["login:work", 120, 60_000],
      [`login:credential:${key}`, 5, 15 * 60_000],
    ] as const) {
      const attempt = tx.select().from(loginAttempts)
        .where(eq(loginAttempts.key, bucket)).get();
      if (attempt && attempt.count >= limit)
        throw new AppError("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
      tx.insert(loginAttempts).values({ key: bucket, count: 1, resetAt: now + window })
        .onConflictDoUpdate({ target: loginAttempts.key,
          set: { count: (attempt?.count ?? 0) + 1 } }).run();
    }
  }, { behavior: "immediate" });
}
export async function authenticate(username: unknown, password: unknown) {
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 64 ||
    password.length > 256
  )
    throw new AppError("Usuário ou senha inválidos.", 401);
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure SESSION_SECRET.");
  const key = createHmac("sha256", secret).update(JSON.stringify([username, password])).digest("hex");
  reserveLoginAttempt(key);
  const account = database().db.select().from(accounts).get();
  // Always verify against the configured hash, including for unknown usernames.
  const valid = account ? await verify(account.passwordHash, password) : false;
  if (!account || !valid || account.username !== username)
    throw new AppError("Usuário ou senha inválidos.", 401);
  database().db.delete(loginAttempts).where(eq(loginAttempts.key, `login:credential:${key}`)).run();
  return account;
}
