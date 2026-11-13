import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, openDatabase } from "../lib/server/database";
import { accounts, profiles } from "../lib/server/schema";
import {
  setupAccount,
  authenticate,
  reserveLoginAttempt,
} from "../lib/server/credentials";
import {
  snapshot,
  mutate,
  listProfiles,
  ownedProfile,
  editProfile,
} from "../lib/server/store";
import {
  validateActivityInput,
  validateBackup,
  validateActivityRecords,
  makeBackup,
  readActivities,
  ACTIVITY_STORAGE_KEY,
} from "../lib/activities";

const directory = mkdtempSync(join(tmpdir(), "oquefazer-tests-"));
process.env.SESSION_SECRET = crypto.randomUUID();
process.env.SQLITE_PATH = join(directory, "database.sqlite");
const input = {
  title: "Ler um livro",
  description: "Descrição",
  category: "Livros",
  status: "Quero fazer",
  imageUrl: "",
  linkUrl: "",
};
const password = "test-only-" + crypto.randomUUID();
let accountId: string, first: string, second: string;
after(() => {
  database().sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test("validadores rejeitam categorias, status, URLs, datas, duplicatas e conteúdo inválido", () => {
  assert.equal(validateActivityInput(input).title, input.title);
  for (const change of [
    { category: "inválida" },
    { status: "inválido" },
    { title: " " },
    { description: 1 },
    { title: "x".repeat(121) },
    { linkUrl: "javascript:alert(1)" },
    { imageUrl: "x".repeat(4097) },
  ]) {
    assert.throws(() => validateActivityInput({ ...input, ...change }));
  }
  assert.throws(() => validateActivityInput(null));
  assert.throws(() => validateBackup({ version: 2 }));
  assert.throws(() =>
    validateActivityRecords([
      { ...input, id: "a", createdAt: "ontem", updatedAt: "hoje" },
    ]),
  );
});
test("setup atômico cria exatamente dois perfis, senha Argon2id e recusa nova conta", async () => {
  await assert.rejects(setupAccount("user", "curta", ["Um", "Dois"]));
  assert.equal(database().db.select().from(accounts).all().length, 0);
  await setupAccount("shared", password, ["Pessoa um", "Pessoa dois"]);
  const account = database().db.select().from(accounts).get()!;
  accountId = account.id;
  assert.ok(account.passwordHash.startsWith("$argon2id$"));
  assert.ok(!account.passwordHash.includes(password));
  const choices = listProfiles(accountId);
  assert.equal(choices.length, 2);
  [first, second] = choices.map((p) => p.id);
  await assert.rejects(setupAccount("another", password, ["Três", "Quatro"]));
  assert.equal(database().db.select().from(accounts).all().length, 1);
});
test("autenticação aceita credenciais corretas e rejeita usuário/senha inválidos", async () => {
  assert.equal((await authenticate("shared", password)).id, accountId);
  await assert.rejects(authenticate("shared", "errada"));
  await assert.rejects(authenticate("inexistente", password));
});
test("CRUD mantém isolamento, valida autorização e detecta gravações concorrentes", () => {
  let state = mutate(accountId, first, 0, "create", input);
  const id = state.activities[0].id;
  assert.equal(state.revision, 1);
  assert.equal(snapshot(accountId, second).activities.length, 0);
  assert.throws(() => ownedProfile("outra-conta", first));
  assert.throws(() => mutate(accountId, second, 0, "update", input, id));
  assert.throws(() => mutate(accountId, first, 0, "delete", null, id));
  state = mutate(
    accountId,
    first,
    1,
    "update",
    { title: "Atualizada", status: "Concluído", category: "Filmes e séries" },
    id,
  );
  assert.equal(state.activities[0].title, "Atualizada");
  assert.equal(state.activities[0].status, "Concluído");
  assert.throws(() =>
    mutate(accountId, first, 2, "update", { category: "inválida" }, id),
  );
  assert.equal(snapshot(accountId, first).revision, 2);
  state = mutate(accountId, first, 2, "delete", null, id);
  assert.equal(state.activities.length, 0);
});
test("backup v1 substitui apenas o perfil selecionado e faz rollback quando inválido", () => {
  const one = mutate(accountId, first, 3, "create", input);
  const two = mutate(accountId, second, 0, "create", {
    ...input,
    title: "Outra lista",
  });
  const backup = validateBackup(
    JSON.parse(JSON.stringify(makeBackup(one.activities))),
  );
  const imported = mutate(accountId, second, two.revision, "replace", backup);
  assert.deepEqual(imported.activities, one.activities); // Same IDs can safely exist in independent profiles.
  assert.deepEqual(snapshot(accountId, first).activities, one.activities);
  const invalid = {
    ...backup,
    activities: [
      ...backup.activities,
      { ...backup.activities[0], id: "invalid", status: "no" },
    ],
  };
  assert.throws(() =>
    mutate(accountId, second, imported.revision, "replace", invalid),
  );
  assert.deepEqual(snapshot(accountId, second), {
    activities: imported.activities,
    revision: imported.revision,
  });
  assert.throws(() =>
    validateActivityRecords([...one.activities, ...one.activities]),
  );
});
test("migração local preserva IDs e datas, é repetível e conflitos revertem a transação", () => {
  const before = snapshot(accountId, first);
  const record = {
    ...before.activities[0],
    id: "legacy-id",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  };
  const local = JSON.stringify([record]);
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => {
          assert.equal(key, ACTIVITY_STORAGE_KEY);
          return local;
        },
      },
    },
  });
  try {
    const state = mutate(
      accountId,
      first,
      before.revision,
      "merge",
      readActivities(),
    );
    assert.equal(state.imported, 1);
    assert.deepEqual(
      state.activities.find((a) => a.id === record.id),
      record,
    );
    const repeated = mutate(
      accountId,
      first,
      state.revision,
      "merge",
      readActivities(),
    );
    assert.equal(repeated.skipped, 1);
    assert.equal(repeated.imported, 0);
    assert.throws(() =>
      mutate(accountId, first, repeated.revision, "merge", [
        { ...record, id: "insert-before-conflict" },
        { ...record, title: "Conflito" },
      ]),
    );
    assert.deepEqual(snapshot(accountId, first), {
      activities: repeated.activities,
      revision: repeated.revision,
    });
    assert.equal(window.localStorage.getItem(ACTIVITY_STORAGE_KEY), local);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
test("edição de perfis valida propriedade, nome e avatar", () => {
  editProfile(accountId, first, { name: "Novo nome", avatar: "star" });
  assert.equal(listProfiles(accountId)[0].name, "Novo nome");
  assert.throws(() =>
    editProfile(accountId, first, { name: "", avatar: "star" }),
  );
  assert.throws(() =>
    editProfile("foreign", first, { name: "Um", avatar: "star" }),
  );
});
test("migrações são idempotentes e mantêm integridade, índices e registros", () => {
  const original = snapshot(accountId, first);
  const reopened = openDatabase(process.env.SQLITE_PATH!);
  try {
    assert.equal(reopened.db.select().from(accounts).all().length, 1);
    assert.equal(reopened.db.select().from(profiles).all().length, 2);
    assert.deepEqual(reopened.sqlite.pragma("foreign_key_check"), []);
    assert.deepEqual(reopened.sqlite.pragma("integrity_check"), [
      { integrity_check: "ok" },
    ]);
    assert.throws(() =>
      reopened.db
        .insert(profiles)
        .values({ id: "third", accountId, name: "Third", displayOrder: 2 })
        .run(),
    );
    assert.throws(() =>
      reopened.db
        .insert(profiles)
        .values({
          id: "orphan",
          accountId: "missing",
          name: "Orphan",
          displayOrder: 0,
        })
        .run(),
    );
    assert.deepEqual(snapshot(accountId, first), original);
    assert.equal(
      (
        reopened.sqlite
          .prepare("select count(*) as n from __drizzle_migrations")
          .get() as { n: number }
      ).n,
      1,
    );
  } finally {
    reopened.sqlite.close();
  }
});
test("limite persiste, isola credenciais e expira", async () => {
  const now = Date.now() + 60 * 60 * 1000;
  for (let i = 0; i < 5; i++) reserveLoginAttempt("wrong", now);
  assert.throws(() => reserveLoginAttempt("wrong", now), /Muitas tentativas/);
  reserveLoginAttempt("correct", now);
  const other = openDatabase(process.env.SQLITE_PATH!);
  try {
    assert.equal((other.sqlite.prepare("select count from login_attempts where key = ?").get("login:credential:wrong") as { count: number }).count, 5);
  } finally { other.sqlite.close(); }
  reserveLoginAttempt("wrong", now + 15 * 60_000);
  for (let i = 0; i < 119; i++) reserveLoginAttempt(`guess-${i}`, now + 15 * 60_000);
  assert.throws(() => reserveLoginAttempt("new", now + 15 * 60_000), /Muitas tentativas/);
  reserveLoginAttempt("new", now + 16 * 60_000);
  await assert.rejects(authenticate("shared", "wrong"));
  assert.equal((await authenticate("shared", password)).id, accountId);
});
