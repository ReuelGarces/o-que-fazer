import "server-only";
import { and, eq, asc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { database } from "./database";
import { activities, profiles } from "./schema";
import { AppError } from "./errors";
import {
  validateActivityInput,
  validateActivityRecords,
  validateBackup,
  type Activity,
} from "../activities";

export function ownedProfile(accountId: string, profileId: string) {
  const profile = database()
    .db.select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
    .get();
  if (!profile) throw new AppError("Perfil indisponível.", 403);
  return profile;
}
export function listProfiles(accountId: string) {
  return database()
    .db.select({
      id: profiles.id,
      name: profiles.name,
      avatar: profiles.avatar,
    })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .orderBy(asc(profiles.displayOrder))
    .all();
}
export function snapshot(accountId: string, profileId: string) {
  return database().db.transaction((tx) => {
    const profile = ownedProfile(accountId, profileId);
    const rows = tx
      .select()
      .from(activities)
      .where(eq(activities.profileId, profileId))
      .orderBy(asc(activities.createdAt), asc(activities.id))
      .all();
    return {
      revision: profile.revision,
      activities: rows.map(({ profileId: _profileId, ...row }) => {
        void _profileId;
        return row;
      }),
    };
  });
}
export function mutate(
  accountId: string,
  profileId: string,
  revision: number,
  operation: string,
  value: unknown,
  id?: string,
) {
  const { db } = database();
  return db.transaction(
    (tx) => {
      const profile = ownedProfile(accountId, profileId);
      if (!Number.isSafeInteger(revision) || profile.revision !== revision) {
        throw new AppError(
          "A lista mudou em outra aba. Atualize a página antes de tentar novamente; suas alterações não foram salvas.",
          409,
        );
      }
      const scope = and(
        eq(activities.profileId, profileId),
        eq(activities.id, id ?? ""),
      );
      let imported = 0,
        skipped = 0;
      if (operation === "create") {
        const now = new Date().toISOString();
        tx.insert(activities)
          .values({
            ...validateActivityInput(value),
            id: randomUUID(),
            profileId,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      } else if (operation === "update" || operation === "delete") {
        const existing = tx.select().from(activities).where(scope).get();
        if (!existing) throw new AppError("Atividade não encontrada.", 404);
        if (operation === "delete") tx.delete(activities).where(scope).run();
        else {
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new AppError("Alterações inválidas.");
          tx.update(activities)
            .set({
              ...validateActivityInput({ ...existing, ...value }),
              updatedAt: new Date().toISOString(),
            })
            .where(scope)
            .run();
        }
      } else if (operation === "replace" || operation === "merge") {
        const records =
          operation === "replace"
            ? validateBackup(value).activities
            : validateActivityRecords(value);
        if (operation === "replace")
          tx.delete(activities)
            .where(eq(activities.profileId, profileId))
            .run();
        for (const record of records) {
          const existing = tx
            .select()
            .from(activities)
            .where(
              and(
                eq(activities.profileId, profileId),
                eq(activities.id, record.id),
              ),
            )
            .get();
          if (existing) {
            const same = (Object.keys(record) as (keyof Activity)[]).every(
              (key) => existing[key] === record[key],
            );
            if (!same)
              throw new AppError(
                "Há um ID local em conflito com a lista. Nada foi importado. Exporte os dados e resolva o conflito antes de repetir.",
                409,
              );
            skipped++;
            continue;
          }
          tx.insert(activities)
            .values({ ...record, profileId })
            .run();
          imported++;
        }
      } else throw new AppError("Operação inválida.");
      tx.update(profiles)
        .set({ revision: sql`${profiles.revision} + 1` })
        .where(eq(profiles.id, profileId))
        .run();
      return { ...snapshot(accountId, profileId), imported, skipped };
    },
    { behavior: "immediate" },
  );
}
export const AVATARS = ["compass", "book", "mountain", "star"] as const;
export function editProfile(
  accountId: string,
  profileId: string,
  value: unknown,
) {
  ownedProfile(accountId, profileId);
  const input = value as { name?: unknown; avatar?: unknown };
  if (
    !input ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 40 ||
    !AVATARS.includes(input.avatar as (typeof AVATARS)[number])
  )
    throw new AppError(
      "Informe um nome de até 40 caracteres e um avatar válido.",
    );
  database()
    .db.update(profiles)
    .set({ name: input.name.trim(), avatar: input.avatar as string })
    .where(eq(profiles.id, profileId))
    .run();
}
