import "server-only";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { database } from "./database";
import { accounts, sessions } from "./schema";
import { AppError } from "./errors";
import { ownedProfile } from "./store";

type Session = { accountId?: string; profileId?: string; token?: string };
export const SESSION_TTL = 60 * 60 * 24 * 7;
export async function session() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32)
    throw new Error(
      "Configure SESSION_SECRET com pelo menos 32 caracteres aleatórios.",
    );
  return getIronSession<Session>(await cookies(), {
    password,
    cookieName: "oqf_session",
    ttl: SESSION_TTL,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL,
    },
  });
}
export async function authenticated() {
  const current = await session();
  if (!current.accountId || !current.token)
    throw new AppError("Entre para continuar.", 401);
  const { db } = database();
  const valid = db
    .select()
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(
      and(
        eq(sessions.id, current.token),
        eq(sessions.accountId, current.accountId),
        gt(sessions.expiresAt, Date.now()),
      ),
    )
    .get();
  if (!valid) throw new AppError("Sua sessão expirou. Entre novamente.", 401);
  return current as typeof current & { accountId: string; token: string };
}
export async function selectedProfile(expected?: string | null) {
  const current = await authenticated();
  if (!current.profileId) throw new AppError("Selecione um perfil.", 403);
  if (expected !== undefined && expected !== current.profileId)
    throw new AppError(
      "O perfil mudou. Atualize a página antes de continuar.",
      409,
    );
  ownedProfile(current.accountId, current.profileId);
  return { ...current, profileId: current.profileId };
}
export async function createSession(accountId: string) {
  const current = await session();
  const { db } = database();
  db.delete(sessions).where(lte(sessions.expiresAt, Date.now())).run();
  if (current.token)
    db.delete(sessions).where(eq(sessions.id, current.token)).run();
  current.accountId = accountId;
  delete current.profileId;
  current.token = randomBytes(32).toString("hex");
  db.insert(sessions)
    .values({
      id: current.token,
      accountId,
      expiresAt: Date.now() + SESSION_TTL * 1000,
    })
    .run();
  await current.save();
}
export async function logout() {
  const current = await session();
  if (current.token)
    database().db.delete(sessions).where(eq(sessions.id, current.token)).run();
  current.destroy();
}
