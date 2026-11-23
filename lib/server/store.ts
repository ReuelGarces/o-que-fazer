import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { database } from "./database";
import { activities, activityCompletions, profiles } from "./schema";
import { AppError } from "./errors";
import {
  currentLocalDate,
  nextOccurrenceDate,
  validateActivityInput,
  validateActivityRecords,
  validateBackup,
  type Activity,
} from "../activities";

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof database>["db"]["transaction"]>[0]
>[0];

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

function getLatestCompletion(
  tx: DatabaseTransaction,
  profileId: string,
  activityId: string,
) {
  return tx
    .select()
    .from(activityCompletions)
    .where(
      and(
        eq(activityCompletions.profileId, profileId),
        eq(activityCompletions.activityId, activityId),
      ),
    )
    .orderBy(desc(activityCompletions.completedAt), desc(activityCompletions.id))
    .limit(1)
    .get();
}

function readSnapshot(tx: DatabaseTransaction, accountId: string, profileId: string) {
  const profile = tx
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
    .get();
  if (!profile) throw new AppError("Perfil indisponível.", 403);

  const rows = tx
    .select()
    .from(activities)
    .where(eq(activities.profileId, profileId))
    .orderBy(asc(activities.createdAt), asc(activities.id))
    .all();
  const completions = tx
    .select()
    .from(activityCompletions)
    .where(eq(activityCompletions.profileId, profileId))
    .orderBy(desc(activityCompletions.completedAt), desc(activityCompletions.id))
    .all();

  return {
    revision: profile.revision,
    activities: rows.map(({ profileId: _profileId, ...row }) => {
      void _profileId;
      return row;
    }),
    completions: completions.map(({ profileId: _profileId, ...row }) => {
      void _profileId;
      return row;
    }),
  };
}

/** Reconciles due calendar dates during reads, so no external scheduler is needed. */
export function snapshot(accountId: string, profileId: string, localDate = currentLocalDate()) {
  const { db } = database();
  return db.transaction(
    (tx) => {
      const profile = tx
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
        .get();
      if (!profile) throw new AppError("Perfil indisponível.", 403);

      const completedRows = tx
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.profileId, profileId),
            eq(activities.status, "Concluído"),
          ),
        )
        .all();
      let changed = false;
      const now = new Date().toISOString();
      for (const activity of completedRows) {
        if (activity.recurrence === "none") continue;

        let nextOccurrenceOn = activity.nextOccurrenceOn;
        if (!nextOccurrenceOn) {
          const latest = getLatestCompletion(tx, profileId, activity.id);
          nextOccurrenceOn = nextOccurrenceDate(
            latest?.completedOn ?? localDate,
            activity.recurrence,
            activity.recurrenceInterval,
            activity.recurrenceAnchorDay,
          );
          if (nextOccurrenceOn) {
            tx.update(activities)
              .set({ nextOccurrenceOn, updatedAt: now })
              .where(and(eq(activities.profileId, profileId), eq(activities.id, activity.id)))
              .run();
            changed = true;
          }
        }

        if (nextOccurrenceOn && nextOccurrenceOn <= localDate) {
          tx.update(activities)
            .set({ status: "Quero fazer", nextOccurrenceOn: null, updatedAt: now })
            .where(and(eq(activities.profileId, profileId), eq(activities.id, activity.id)))
            .run();
          changed = true;
        }
      }

      if (changed) {
        tx.update(profiles)
          .set({ revision: sql`${profiles.revision} + 1` })
          .where(eq(profiles.id, profileId))
          .run();
      }
      return readSnapshot(tx, accountId, profileId);
    },
    { behavior: "immediate" },
  );
}

function suppliedCompletionId(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const id = (value as Record<string, unknown>).completionId;
  return typeof id === "string" ? id : undefined;
}

function dayOfDate(value: string): number {
  return Number(value.slice(8, 10));
}

export function mutate(
  accountId: string,
  profileId: string,
  revision: number,
  operation: string,
  value: unknown,
  id?: string,
  localDate = currentLocalDate(),
) {
  const { db } = database();
  return db.transaction(
    (tx) => {
      const profile = tx
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
        .get();
      if (!profile) throw new AppError("Perfil indisponível.", 403);
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
      let imported = 0;
      let skipped = 0;
      const now = new Date().toISOString();

      function insertCompletion(activityId: string, completedOn: string) {
        tx.insert(activityCompletions)
          .values({
            id: randomUUID(),
            profileId,
            activityId,
            completedOn,
            completedAt: now,
            reopenedAt: null,
          })
          .run();
      }

      function initialSchedule(input: ReturnType<typeof validateActivityInput>, anchorDay: number | null) {
        const monthlyAnchor = input.recurrence === "monthly"
          ? anchorDay ?? dayOfDate(localDate)
          : null;
        return {
          recurrenceAnchorDay: monthlyAnchor,
          nextOccurrenceOn: nextOccurrenceDate(
            localDate,
            input.recurrence,
            input.recurrenceInterval,
            monthlyAnchor,
          ),
        };
      }

      if (operation === "create") {
        const input = validateActivityInput(value);
        const schedule = input.status === "Concluído"
          ? initialSchedule(input, null)
          : { recurrenceAnchorDay: null, nextOccurrenceOn: null };
        const activityId = randomUUID();
        tx.insert(activities)
          .values({
            ...input,
            ...schedule,
            id: activityId,
            profileId,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        if (input.status === "Concluído") insertCompletion(activityId, localDate);
      } else if (operation === "update" || operation === "delete") {
        const existing = tx.select().from(activities).where(scope).get();
        if (!existing) throw new AppError("Atividade não encontrada.", 404);
        if (operation === "delete") {
          tx.delete(activities).where(scope).run();
        } else {
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new AppError("Alterações inválidas.");
          const input = validateActivityInput({ ...existing, ...value });
          const latest = getLatestCompletion(tx, profileId, existing.id);
          let recurrenceAnchorDay = input.status === "Concluído" && input.recurrence === "monthly"
            ? existing.recurrence === "monthly"
              ? existing.recurrenceAnchorDay ?? (latest ? dayOfDate(latest.completedOn) : dayOfDate(localDate))
              : latest
                ? dayOfDate(latest.completedOn)
                : dayOfDate(localDate)
            : null;
          let nextOccurrenceOn: string | null = null;

          if (input.status === "Concluído" && input.recurrence !== "none") {
            if (existing.status !== "Concluído") {
              const schedule = initialSchedule(input, recurrenceAnchorDay);
              recurrenceAnchorDay = schedule.recurrenceAnchorDay;
              nextOccurrenceOn = schedule.nextOccurrenceOn;
              insertCompletion(existing.id, localDate);
            } else if (
              input.recurrence !== existing.recurrence ||
              input.recurrenceInterval !== existing.recurrenceInterval
            ) {
              const schedule = initialSchedule(input, recurrenceAnchorDay);
              recurrenceAnchorDay = schedule.recurrenceAnchorDay;
              nextOccurrenceOn = nextOccurrenceDate(
                latest?.completedOn ?? localDate,
                input.recurrence,
                input.recurrenceInterval,
                recurrenceAnchorDay,
              );
            } else {
              nextOccurrenceOn = existing.nextOccurrenceOn;
            }
          } else if (input.status === "Concluído" && existing.status !== "Concluído") {
            insertCompletion(existing.id, localDate);
          } else if (existing.status === "Concluído" && input.status !== "Concluído") {
            const completionId = suppliedCompletionId(value);
            const selectedCompletion = completionId
              ? tx.select()
                  .from(activityCompletions)
                  .where(
                    and(
                      eq(activityCompletions.profileId, profileId),
                      eq(activityCompletions.activityId, existing.id),
                      eq(activityCompletions.id, completionId),
                    ),
                  )
                  .get()
              : latest;
            if (selectedCompletion && !selectedCompletion.reopenedAt) {
              tx.update(activityCompletions)
                .set({ reopenedAt: now })
                .where(
                  and(
                    eq(activityCompletions.profileId, profileId),
                    eq(activityCompletions.id, selectedCompletion.id),
                  ),
                )
                .run();
            }
          }

          tx.update(activities)
            .set({
              ...input,
              nextOccurrenceOn,
              recurrenceAnchorDay,
              updatedAt: now,
            })
            .where(scope)
            .run();
        }
      } else if (operation === "replace" || operation === "merge") {
        const backup = operation === "replace" ? validateBackup(value) : null;
        const records = backup?.activities ?? validateActivityRecords(value);
        if (operation === "replace") {
          tx.delete(activities)
            .where(eq(activities.profileId, profileId))
            .run();
          for (const record of records) {
            tx.insert(activities)
              .values({ ...record, profileId })
              .run();
          }
          for (const completion of backup?.completions ?? []) {
            tx.insert(activityCompletions)
              .values({ ...completion, profileId })
              .run();
          }
          imported = records.length;
        } else {
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
        }
      } else throw new AppError("Operação inválida.");

      tx.update(profiles)
        .set({ revision: sql`${profiles.revision} + 1` })
        .where(eq(profiles.id, profileId))
        .run();
      return { ...snapshot(accountId, profileId, localDate), imported, skipped };
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
