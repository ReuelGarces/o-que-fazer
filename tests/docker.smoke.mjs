import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const id = `oqf-smoke-${randomUUID()}`;
const image = id, volume = `${id}-data`, container = `${id}-app`;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", timeout: 600_000 });
const secret = randomUUID();
const env = ["-e", "SQLITE_PATH=/var/lib/sqlite/database.sqlite", "-e", `SESSION_SECRET=${secret}`, "-e", "APP_ORIGIN=https://example.invalid"];
const node = ["node", "--conditions=react-server", "--import", "tsx"];
const run = (...args) => docker("run", "--rm", "-v", `${volume}:/var/lib/sqlite`, ...env, image, ...args);
test("Docker Node 24, migrations, permissions, persistence and invalid configuration", { timeout: 900_000 }, async () => {
  try {
    docker("build", "-t", image, ".");
    docker("volume", "create", volume);
    assert.match(run("node", "--version"), /^v24\./);
    assert.equal(run("id", "-u").trim(), "1000");
    assert.equal(run("id", "-g").trim(), "1000");
    run(...node, "scripts/migrate.ts");
    run(...node, "scripts/migrate.ts");
    run(...node, "-e", `const {database}=require('./lib/server/database.ts'); const s=database().sqlite; s.exec("CREATE TABLE smoke(value TEXT); INSERT INTO smoke VALUES('persisted')"); s.close();`);
    const check = () => assert.match(run(...node, "-e", `const fs=require('node:fs'); const {database}=require('./lib/server/database.ts'); const s=database().sqlite; if ((fs.statSync(process.env.SQLITE_PATH).mode & 511)!==384) process.exit(2); console.log(s.prepare('SELECT value FROM smoke').get().value); s.close();`), /persisted/);
    docker("run", "-d", "--name", container, "-v", `${volume}:/var/lib/sqlite`, ...env, image);
    const ready = async () => {
      for (let i=0;i<60;i++) {
        try { docker("exec", container, "node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"); return; } catch { await new Promise(r=>setTimeout(r,1000)); }
      }
      assert.fail("Container did not become ready");
    };
    await ready(); check();
    docker("restart", container); await ready(); check();
    docker("rm", "-f", container);
    docker("run", "-d", "--name", container, "-v", `${volume}:/var/lib/sqlite`, ...env, image);
    await ready(); check();
    docker("rm", "-f", container);
    run(...node, "scripts/migrate.ts"); check();
    for (const [key,value] of [["SESSION_SECRET","short"],["APP_ORIGIN","http://invalid"],["APP_ORIGIN","https://invalid/path"],["SQLITE_PATH","relative.sqlite"],["SQLITE_PATH","/root/denied.sqlite"]]) {
      assert.throws(() => docker("run", "--rm", "-v", `${volume}:/var/lib/sqlite`, ...env, "-e", `${key}=${value}`, image));
    }
  } finally {
    try { docker("rm", "-f", container); } catch {}
    try { docker("volume", "rm", volume); } catch {}
    try { docker("image", "rm", image); } catch {}
  }
});
