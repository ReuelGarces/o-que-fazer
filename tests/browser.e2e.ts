import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { database } from "../lib/server/database";
import { setupAccount } from "../lib/server/credentials";
import { ACTIVITY_STORAGE_KEY } from "../lib/activities";

test(
  "navegador: login, perfis, formulário assíncrono, CRUD, filtros, backup e migração local",
  { timeout: 120000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "oquefazer-browser-"));
    process.env.SQLITE_PATH = join(directory, "test.sqlite");
    const password = crypto.randomUUID();
    await setupAccount("shared", password, ["Pessoa um", "Pessoa dois"]);
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((r) => socket.close(() => r()));
    const base = `http://127.0.0.1:${port}`;
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
          APP_ORIGIN: base,
        },
        stdio: "ignore",
      },
    );
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(12000);
  const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const artifacts =
      process.env.UI_ARTIFACT_DIR || join(tmpdir(), "oquefazer-ui-artifacts");
    mkdirSync(artifacts, { recursive: true });
    async function capture(filename: string) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.screenshot({ path: join(artifacts, filename), fullPage: true });
    }

    try {
      for (let i = 0; i < 150; i++) {
        try {
          if ((await fetch(base + "/login")).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      await page.goto(base);
      await expect(page).toHaveURL(base + "/login");
      await capture("login-desktop.png");
      await page.getByLabel("Usuário", { exact: true }).fill("shared");
      await page.getByLabel("Senha", { exact: true }).fill("errada");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page.locator(".callout[role=alert]")).toContainText(
        "Usuário ou senha inválidos",
      );
      await page.getByLabel("Senha", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Quem está usando?" }),
      ).toBeVisible();
      await capture("profiles-desktop.png");
      await page
        .getByRole("button", { name: "Pessoa um", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "O que fazer?", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Guardar uma ideia" }).click();
      await page.locator("#activity-title").fill("Aprender SQLite");
      await page
        .locator("#activity-category")
        .selectOption("Cursos");
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => {
        release = r;
      });
      let intercepted = false;
      await page.route("**/api/activities", async (route) => {
        if (route.request().method() === "POST") {
          intercepted = true;
          await gate;
        }
        await route.continue();
      });
      await page.getByRole("button", { name: "Adicionar à lista" }).click();
      await expect(
        page.getByRole("button", { name: "Salvando…" }),
      ).toBeDisabled();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect.poll(() => intercepted).toBe(true);
      release();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await page.unroute("**/api/activities");
      await expect(page.locator(".expanding-card__title")).toHaveText(
        "Aprender SQLite",
      );
      await page.locator(".expanding-card__title").click();
      await page
        .getByLabel("Alterar status de Aprender SQLite")
        .selectOption("Em andamento");
      await expect(page.getByRole("status")).toContainText("Status atualizado");
      await page
        .getByRole("button", { name: "Editar Aprender SQLite", exact: true })
        .click();
      await page
        .locator("#activity-title")
        .fill("Aprender Drizzle");
      // A rejected save keeps both the dialog and the draft.
      await page.route("**/api/activities/*", (route) =>
        route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Conflito de revisão de teste" }),
        }),
      );
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator("#activity-title")).toHaveValue(
        "Aprender Drizzle",
      );
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
        "Conflito",
      );
      await page.unroute("**/api/activities/*");
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await page.getByLabel("Buscar por título").fill("inexistente");
      await expect(
        page.getByRole("heading", { name: "Nenhuma ideia encontrada" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Limpar filtros" }).click();
      await page
        .getByLabel("Filtrar por categoria", { exact: true })
        .selectOption("Livros");
      await expect(
        page.getByRole("heading", { name: "Nenhuma ideia encontrada" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Limpar filtros" }).click();
      await capture("list-desktop.png");
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar", exact: true }).click();
      const backupPath = join(directory, "backup.json");
      await (await downloaded).saveAs(backupPath);
      await page.locator(".expanding-card__title").click();
      await page
        .getByRole("button", { name: "Excluir Aprender Drizzle", exact: true })
        .click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page
        .getByRole("button", { name: "Excluir atividade", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Comece por algo que sempre quis fazer",
        }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByLabel("Selecionar arquivo de backup JSON")
        .setInputFiles(backupPath);
      await expect(page.locator(".expanding-card__title")).toHaveText(
        "Aprender Drizzle",
      );
      await page.getByRole("link", { name: /Trocar perfil/ }).click();
      await page
        .getByRole("button", { name: "Pessoa dois", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Comece por algo que sempre quis fazer",
        }),
      ).toBeVisible();
      await page.evaluate((key) => {
        const now = "2024-01-01T00:00:00.000Z";
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              id: "old-browser-id",
              title: "Ideia antiga",
              description: "",
              category: "Lugares",
              status: "Quero fazer",
              imageUrl: "",
              linkUrl: "",
              createdAt: now,
              updatedAt: now,
            },
          ]),
        );
      }, ACTIVITY_STORAGE_KEY);
      await page.reload();
      await expect(
        page.getByText("1 atividade antiga disponível.", { exact: false }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Importar para Pessoa dois" })
        .click();
      await expect(page.locator(".expanding-card__title")).toHaveText(
        "Ideia antiga",
      );
      assert.ok(
        await page.evaluate(
          (key) => localStorage.getItem(key),
          ACTIVITY_STORAGE_KEY,
        ),
      );
      await page.getByRole("link", { name: /Trocar perfil/ }).click();
      await page
        .getByRole("button", { name: "Editar perfil de Pessoa dois" })
        .click();
      await page.getByLabel("Nome", { exact: true }).fill("Novo nome");
      await page.locator("select[name=avatar]").selectOption("mountain");
      await page.getByRole("button", { name: "Salvar perfil" }).click();
      await expect(
        page.getByRole("button", { name: "Novo nome", exact: true }),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await capture("profiles-mobile.png");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .getByRole("button", { name: "Pessoa um", exact: true })
        .click();
      await expect(page.locator(".expanding-card__title")).toHaveText(
        "Aprender Drizzle",
      );
      await capture("list-mobile.png");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.getByRole("button", { name: "Sair", exact: true }).click();
      await expect(page).toHaveURL(base + "/login");
      await capture("login-mobile.png");
      assert.deepEqual(errors, []);
      console.log(`Capturas de verificação: ${artifacts}`);
    } catch (error) {
      await capture("failure.png");
      throw error;
    } finally {
      await browser.close();
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
