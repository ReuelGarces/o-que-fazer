import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { eq } from "drizzle-orm";
import { database } from "../lib/server/database";
import { setupAccount } from "../lib/server/credentials";
import { accounts, profiles, sessions } from "../lib/server/schema";
import type { Activity, ActivityBackup } from "../lib/activities";

test(
  "Next.js em produção: autenticação, cookies, CSRF, CRUD, perfis e backups",
  { timeout: 120000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "oquefazer-http-"));
    process.env.SQLITE_PATH = join(directory, "test.sqlite");
    const password = crypto.randomUUID();
    await setupAccount("shared", password, ["Primeiro", "Segundo"]);
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((r) => socket.close(() => r()));
    const base = `http://127.0.0.1:${port}`,
      origin = "https://oquefazer.test";
    let output = "";
    const server = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          SESSION_SECRET: crypto.randomUUID() + crypto.randomUUID(),
          APP_ORIGIN: origin,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.on("data", (chunk) => {
      output += chunk;
    });
    server.stderr.on("data", (chunk) => {
      output += chunk;
    });
    let cookie = "",
      profileId = "",
      revision = 0;
    async function request(
      path: string,
      method = "GET",
      data?: unknown,
      extra: Record<string, string> = {},
    ) {
      return fetch(base + path, {
        method,
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: cookie,
          "x-profile-id": profileId,
          "if-match": String(revision),
          ...extra,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    }
    async function select(id: string) {
      const result = await request("/api/profiles/select", "POST", {
        profileId: id,
      });
      assert.equal(result.status, 200);
      cookie = result.headers.get("set-cookie")!.split(";")[0];
      profileId = id;
      const list = await (await request("/api/activities")).json();
      revision = list.revision;
    }
    try {
      let ready = false;
      for (let i = 0; i < 150; i++) {
        if (server.exitCode !== null)
          throw new Error(`Servidor encerrou: ${output}`);
        try {
          const result = await fetch(base + "/login");
          if (result.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(ready, output);
      let choices: { id: string; name: string }[] = [],
        activity: Activity,
        backup: ActivityBackup;
      await t.test(
        "páginas e API privadas exigem login; CSRF rejeita origem falsa ou ausente",
        async () => {
          for (const route of ["/", "/profiles"]) {
            const response = await request(route);
            assert.equal(response.status, 307);
            assert.equal(response.headers.get("location"), "/login");
          }
          for (const route of ["activities", "profiles", "backup"])
            assert.equal((await request(`/api/${route}`)).status, 401);
          assert.equal(
            (
              await request(
                "/api/login",
                "POST",
                { username: "shared", password },
                { Origin: "https://attacker.test" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                "/api/login",
                "POST",
                { username: "shared", password },
                { Origin: "" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request("/api/login", "POST", {
                username: "shared",
                password: "errada",
              })
            ).status,
            401,
          );
        },
      );
      await t.test(
        "login emite cookie seguro, exige perfil e rejeita cookie adulterado",
        async () => {
          const result = await request("/api/login", "POST", {
            username: "shared",
            password,
          });
          assert.equal(result.status, 200);
          const header = result.headers.get("set-cookie")!;
          for (const flag of [
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Max-Age=604800",
          ])
            assert.ok(
              header.toLowerCase().includes(flag.toLowerCase()),
              `Cookie deve incluir ${flag}`,
            );
          cookie = header.split(";")[0];
          assert.equal(
            (await request("/")).headers.get("location"),
            "/profiles",
          );
          assert.equal((await request("/api/activities")).status, 403);
          assert.equal(
            (
              await request("/api/profiles", "GET", undefined, {
                Cookie: "oqf_session=tampered",
              })
            ).status,
            401,
          );
          choices = (await (await request("/api/profiles")).json()).profiles;
          assert.equal(choices.length, 2);
          assert.equal(
            (
              await request("/api/profiles/select", "POST", {
                profileId: "foreign",
              })
            ).status,
            403,
          );
          await select(choices[0].id);
          assert.equal((await request("/")).status, 200);
        },
      );
      await t.test(
        "CRUD e exportação confirmam validação, isolamento e controle de concorrência",
        async () => {
          const input = {
            title: "Ideia HTTP",
            description: "Uma ideia",
            category: "Projetos",
            status: "Quero fazer",
            imageUrl: "",
            linkUrl: "https://example.org/",
          };
          assert.equal(
            (
              await request("/api/activities", "POST", {
                ...input,
                status: "invalid",
              })
            ).status,
            400,
          );
          let response = await request("/api/activities", "POST", input);
          assert.equal(response.status, 200);
          let state = await response.json();
          revision = state.revision;
          activity = state.activities[0];
          assert.equal(
            (
              await request(
                `/api/activities/${activity.id}`,
                "PATCH",
                { title: "Conflito" },
                { "if-match": "0" },
              )
            ).status,
            409,
          );
          response = await request(`/api/activities/${activity.id}`, "PATCH", {
            status: "Concluído",
          });
          state = await response.json();
          revision = state.revision;
          assert.equal(state.activities[0].status, "Concluído");
          backup = await (await request("/api/backup")).json();
          assert.equal(backup.version, 1);
          assert.equal(
            (
              await request("/api/activities", "GET", undefined, {
                "x-profile-id": choices[1].id,
              })
            ).status,
            409,
          );
          await select(choices[1].id);
          assert.equal(
            (await (await request("/api/activities")).json()).activities.length,
            0,
          );
          assert.equal(
            (await request(`/api/activities/${activity.id}`, "DELETE")).status,
            404,
          );
        },
      );
      await t.test(
        "importações são atômicas e apenas alteram o perfil selecionado",
        async () => {
          let response = await request("/api/backup", "PUT", backup);
          assert.equal(response.status, 200);
          let state = await response.json();
          revision = state.revision;
          assert.deepEqual(state.activities, backup.activities);
          response = await request("/api/backup", "PUT", {
            ...backup,
            activities: [
              ...backup.activities,
              { ...activity, id: "bad", title: "" },
            ],
          });
          assert.equal(response.status, 400);
          assert.deepEqual(
            (await (await request("/api/activities")).json()).activities,
            backup.activities,
          );
          const legacy = {
            ...activity,
            id: "legacy",
            createdAt: "2023-01-01T00:00:00.000Z",
          };
          response = await request("/api/import-local", "POST", {
            activities: [legacy],
          });
          state = await response.json();
          revision = state.revision;
          assert.equal(state.imported, 1);
          response = await request("/api/import-local", "POST", {
            activities: [legacy],
          });
          state = await response.json();
          revision = state.revision;
          assert.equal(state.skipped, 1);
          response = await request(`/api/activities/${activity.id}`, "DELETE");
          state = await response.json();
          revision = state.revision;
          assert.equal(state.activities.length, 1);
          await select(choices[0].id);
          assert.deepEqual(
            (await (await request("/api/activities")).json()).activities,
            backup.activities,
          );
        },
      );
      await t.test(
        "seleção e edição recusam perfil de outra conta",
        async () => {
          database()
            .db.insert(accounts)
            .values({
              id: "foreign-account",
              username: "foreign",
              passwordHash: "unused",
              createdAt: new Date().toISOString(),
            })
            .run();
          database()
            .db.insert(profiles)
            .values({
              id: "foreign-profile",
              accountId: "foreign-account",
              name: "Foreign",
              displayOrder: 0,
            })
            .run();
          assert.equal(
            (
              await request("/api/profiles/select", "POST", {
                profileId: "foreign-profile",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request("/api/profiles/foreign-profile", "PATCH", {
                name: "Inválido",
                avatar: "star",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request(`/api/profiles/${choices[0].id}`, "PATCH", {
                name: "Renomeado",
                avatar: "star",
              })
            ).status,
            200,
          );
          assert.equal(
            (await (await request("/api/profiles")).json()).profiles[0].name,
            "Renomeado",
          );
        },
      );
      await t.test(
        "logout revoga cookie copiado; sessões expiradas também são rejeitadas",
        async () => {
          const copied = cookie;
          assert.equal((await request("/api/logout", "POST")).status, 200);
          assert.equal(
            (
              await request("/api/profiles", "GET", undefined, {
                Cookie: copied,
              })
            ).status,
            401,
          );
          const result = await request("/api/login", "POST", {
            username: "shared",
            password,
          });
          cookie = result.headers.get("set-cookie")!.split(";")[0];
          const account = database()
            .db.select()
            .from(accounts)
            .where(eq(accounts.username, "shared"))
            .get()!;
          database()
            .db.update(sessions)
            .set({ expiresAt: Date.now() - 1000 })
            .where(eq(sessions.accountId, account.id))
            .run();
          assert.equal((await request("/api/profiles")).status, 401);
        },
      );
    } finally {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = once(server, "exit");
        server.kill();
        await exited;
      }
      database().sqlite.close();
      rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  },
);
