import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../lib/server/database";
import { accounts, profiles } from "../lib/server/schema";

test("scripts: migrações repetidas, setup secreto, backup consistente e startup inválido", () => {
  const directory = mkdtempSync(join(tmpdir(), "oquefazer-scripts-"));
  const filename = join(directory, "database.sqlite"), backup = join(directory, "backup.sqlite");
  const password = crypto.randomUUID(); const secretFile = join(directory, "secret");
  writeFileSync(secretFile, password, { mode: 0o600 });
  const env = { ...process.env, SQLITE_PATH: filename, SETUP_PASSWORD_FILE: secretFile, SETUP_USERNAME: "shared", SETUP_PROFILE_1: "Um", SETUP_PROFILE_2: "Dois", SQLITE_BACKUP_PATH: backup };
  function run(name: string, extra: Record<string, string | undefined> = {}) {
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", `scripts/${name}.ts`], { env: { ...env, ...extra }, encoding: "utf8", timeout: 20000 });
    assert.ok(!result.stdout.includes(password)); assert.ok(!result.stderr.includes(password)); return result;
  }
  try {
    assert.equal(run("migrate").status, 0); assert.equal(run("migrate").status, 0);
    assert.equal(run("setup").status, 0); assert.equal(run("setup").status, 1);
    const live = openDatabase(filename);
    try {
      assert.equal(live.db.select().from(accounts).all().length, 1);
      assert.equal(live.db.select().from(profiles).all().length, 2);
      // Keep a WAL connection open while the separate online backup process runs.
      assert.equal(run("backup").status, 0);
      assert.equal(run("backup").status, 1); // Never overwrite an existing backup.
      const restored = openDatabase(backup);
      try {
        assert.deepEqual(restored.db.select().from(accounts).all(), live.db.select().from(accounts).all());
        assert.deepEqual(restored.db.select().from(profiles).all(), live.db.select().from(profiles).all());
        assert.deepEqual(restored.sqlite.pragma("integrity_check"), [{ integrity_check: "ok" }]);
      } finally { restored.sqlite.close(); }
    } finally { live.sqlite.close(); }
    assert.equal(run("start", { SESSION_SECRET: "", APP_ORIGIN: "" }).status, 1);
    assert.equal(run("start", { SESSION_SECRET: crypto.randomUUID(), APP_ORIGIN: "http://localhost:3000" }).status, 1);
  } finally { rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});
