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

test(
  "navegador: login, perfis, CRUD, seção concluída, recorrência e filtros",
  { timeout: 120000 },
  async () => {
    const browser = await chromium.launch();
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

    async function setTheme(dark: boolean) {
      const isDark =
        (await page.locator("html").getAttribute("data-theme")) === "dark";
      if (isDark === dark) return;

      const profileMenu = page.locator(".profile-menu__trigger");
      await profileMenu.click();
      const themeSwitch = page.getByRole("switch", { name: "Modo noturno" });
      if ((await themeSwitch.isChecked()) !== dark) {
        await page.locator(".profile-menu__theme-row label").click();
      }
      if (dark) {
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      } else {
        await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
      }
      await profileMenu.click();
    }

    async function chooseDialogOption(
      label: string,
      optionLabel: string,
      optionCount: number,
      method: "mouse" | "keyboard" = "mouse",
      screenshotName?: string,
    ) {
      const dialog = page.getByRole("dialog");
      const trigger = dialog.getByRole("combobox", { name: label, exact: true });
      if (method === "keyboard") {
        await trigger.press("ArrowDown");
      } else {
        await trigger.click();
      }

      const menu = dialog.getByRole("listbox", { name: label, exact: true });
      await expect(menu).toBeVisible();
      await expect(dialog.locator(".animated-dropdown__menu")).toHaveCount(1);
      const options = menu.getByRole("option");
      await expect(options).toHaveCount(optionCount);
      for (let index = 0; index < optionCount; index++) {
        await expect(options.nth(index)).toBeVisible();
      }

      const bounds = await menu.evaluate((element) => {
        const container = element.parentElement;
        if (!(container instanceof HTMLDialogElement)) return null;
        const menuRect = element.getBoundingClientRect();
        const dialogRect = container.getBoundingClientRect();
        const left = dialogRect.left + container.clientLeft;
        const top = dialogRect.top + container.clientTop;
        const right = left + container.clientWidth;
        const bottom = top + container.clientHeight;
        return {
          isOpenDialog: container.open,
          position: getComputedStyle(element).position,
          withinDialog: menuRect.left >= left - 1 &&
            menuRect.top >= top - 1 &&
            menuRect.right <= right + 1 &&
            menuRect.bottom <= bottom + 1,
        };
      });
      assert.ok(
        bounds?.isOpenDialog && bounds.position === "absolute" && bounds.withinDialog,
        `O menu ${label} deve estar visível e sem recorte dentro do diálogo: ${JSON.stringify(bounds)}`,
      );

      const option = menu.getByRole("option", {
        name: optionLabel,
        exact: true,
      });
      await expect(option).toBeVisible();
      if (screenshotName) {
        await page.screenshot({ path: join(artifacts, screenshotName) });
      }
      if (method === "keyboard") {
        const optionIndex = await option.evaluate((node) =>
          Array.prototype.indexOf.call(
            node.parentElement?.querySelectorAll('[role="option"]') ?? [],
            node,
          ),
        );
        const focusedIndex = () => menu.evaluate((element) =>
          Array.from(element.querySelectorAll('[role="option"]')).indexOf(
            document.activeElement as HTMLButtonElement,
          ),
        );
        await expect.poll(focusedIndex).toBeGreaterThanOrEqual(0);
        const initialIndex = await focusedIndex();
        const downSteps = (optionIndex - initialIndex + optionCount) % optionCount;
        const upSteps = (initialIndex - optionIndex + optionCount) % optionCount;
        const key = downSteps <= upSteps ? "ArrowDown" : "ArrowUp";
        const steps = Math.min(downSteps, upSteps);
        for (let index = 0; index < steps; index++) {
          await page.keyboard.press(key);
        }
        await expect(option).toBeFocused();
        await page.keyboard.press("Enter");
      } else {
        await option.click();
      }

      await expect(trigger).toContainText(optionLabel);
      return trigger;
    }

    async function chooseExternalOption(
      label: string,
      optionLabel: string,
      resultLabel = label,
    ) {
      const trigger = page.getByRole("combobox", { name: label, exact: true });
      await trigger.click();
      const menu = page.getByRole("listbox", { name: label, exact: true });
      await expect(menu).toBeVisible();
      await expect
        .poll(() => menu.evaluate((element) => element.parentElement === document.body))
        .toBe(true);
      await menu
        .getByRole("option", { name: optionLabel, exact: true })
        .click();
      const resultTrigger = page.getByRole("combobox", {
        name: resultLabel,
        exact: true,
      });
      await expect(resultTrigger).toContainText(optionLabel);
      return resultTrigger;
    }

    async function verifyDialogDropdownsInViewport(
      width: number,
      height: number,
      dark: boolean,
    ) {
      await page.setViewportSize({ width, height });
      await setTheme(dark);
      await page.getByRole("button", { name: "Guardar uma ideia" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const viewport = width < 600 ? "mobile" : "desktop";
      const theme = dark ? "dark" : "light";
      await chooseDialogOption(
        "Categoria da atividade",
        "Lugares",
        7,
        "mouse",
        `dropdown-${theme}-${viewport}.png`,
      );
      await chooseDialogOption("Status da atividade", "Concluído", 3);
      await page.getByRole("switch", { name: "Repetir atividade" }).click();
      await chooseDialogOption("Frequência da atividade", "Todos os dias", 4);
      await page.getByRole("button", { name: "Fechar formulário" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
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

      await verifyDialogDropdownsInViewport(1440, 1000, false);
      await verifyDialogDropdownsInViewport(1440, 1000, true);
      await verifyDialogDropdownsInViewport(390, 844, false);
      await verifyDialogDropdownsInViewport(390, 844, true);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await setTheme(false);

      await page.getByRole("button", { name: "Guardar uma ideia" }).click();
      await page.locator("#activity-title").fill("Aprender SQLite");
      await chooseDialogOption("Categoria da atividade", "Cursos", 7, "keyboard");
      const categoryMenu = page
        .getByRole("dialog")
        .getByRole("listbox", { name: "Categoria da atividade", exact: true });
      await expect(categoryMenu).toBeHidden();
      const categoryTrigger = page
        .getByRole("dialog")
        .getByRole("combobox", { name: "Categoria da atividade", exact: true });
      await categoryTrigger.press("ArrowDown");
      await expect(categoryMenu).toBeVisible();
      await expect.poll(() => page.evaluate(() =>
        document.activeElement?.getAttribute("role"),
      )).toBe("option");
      await page.keyboard.press("Escape");
      await expect(categoryMenu).toBeHidden();
      await expect(categoryTrigger).toBeFocused();
      await chooseDialogOption("Status da atividade", "Em andamento", 3);
      await page.getByRole("switch", { name: "Repetir atividade" }).click();
      await chooseDialogOption("Frequência da atividade", "Todos os dias", 4);
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
      await chooseExternalOption("Alterar status de Aprender SQLite", "Quero fazer");
      await expect(page.getByRole("status")).toContainText("Status atualizado");
      const statusFilter = page.getByRole("combobox", {
        name: "Filtrar por status",
        exact: true,
      });
      await statusFilter.click();
      const statusFilterMenu = page.getByRole("listbox", {
        name: "Filtrar por status",
        exact: true,
      });
      await expect(statusFilterMenu).toBeVisible();
      await page.getByRole("heading", { name: "O que fazer?", exact: true }).click();
      await expect(statusFilterMenu).toBeHidden();
      await page
        .getByRole("button", { name: "Editar Aprender SQLite", exact: true })
        .click();
      await page
        .locator("#activity-title")
        .fill("Aprender Drizzle");
      await chooseDialogOption("Categoria da atividade", "Projetos", 7);
      await chooseDialogOption("Status da atividade", "Em andamento", 3, "keyboard");
      await chooseDialogOption("Frequência da atividade", "Toda semana", 4);
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
      await chooseExternalOption("Filtrar por categoria", "Livros");
      await expect(
        page.getByRole("heading", { name: "Nenhuma ideia encontrada" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Limpar filtros" }).click();
      await capture("list-desktop.png");
      await expect(page.getByRole("button", { name: "Exportar", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Importar", exact: true })).toHaveCount(0);
      await expect(page.locator(".profile-control [data-slot=live-orb]")).toBeVisible();
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
      await page.getByRole("button", { name: "Adicionar primeira ideia" }).click();
      await page.locator("#activity-title").fill("Caminhar");
      await expect(
        page.getByRole("combobox", { name: "Frequência da atividade" }),
      ).toBeVisible();
      await page.getByRole("switch", { name: "Repetir atividade" }).click();
      await chooseDialogOption("Frequência da atividade", "Todos os dias", 4);
      await page.getByRole("button", { name: "Adicionar à lista" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await page.locator(".expanding-card__title").click();
      await chooseExternalOption(
        "Alterar status de Caminhar",
        "Concluído",
        "Alterar status na capa de Caminhar",
      );
      await expect(page.getByRole("status")).toContainText("Status atualizado");
      const completedGroup = page.locator(".activity-status-group--complete");
      await expect(completedGroup).toBeVisible();
      if (await completedGroup.evaluate((group) => (group as HTMLDetailsElement).open)) {
        await completedGroup.locator("summary").click();
      }
      await expect
        .poll(() => completedGroup.evaluate((group) => (group as HTMLDetailsElement).open))
        .toBe(false);
      await expect(completedGroup.locator(".expanding-card__title")).toBeHidden();
      await chooseExternalOption("Filtrar por status", "Concluído");
      await expect
        .poll(() => completedGroup.evaluate((group) => (group as HTMLDetailsElement).open))
        .toBe(true);
      await expect(completedGroup.locator(".expanding-card__title")).toHaveText("Caminhar");
      await expect(completedGroup.locator(".expanding-card__recurrence")).toHaveText("Diário");
      await completedGroup.locator(".expanding-card__title").click();
      await page.getByRole("button", { name: "Editar Caminhar", exact: true }).click();
      await chooseDialogOption("Frequência da atividade", "Toda semana", 4);
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(completedGroup.locator(".expanding-card__recurrence")).toHaveText("Semanal");
      await page.getByRole("button", { name: "Excluir Caminhar", exact: true }).click();
      await page.getByRole("button", { name: "Excluir atividade", exact: true }).click();
      await page.locator(".profile-menu__trigger").click();
      await page.getByRole("link", { name: /Trocar perfil/ }).click();
      await page
        .getByRole("button", { name: "Pessoa dois", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Comece por algo que sempre quis fazer",
        }),
      ).toBeVisible();
      await page.locator(".profile-menu__trigger").click();
      await page.getByRole("link", { name: /Trocar perfil/ }).click();
      await page
        .getByRole("button", { name: "Editar perfil de Pessoa dois" })
        .click();
      await page.getByLabel("Nome", { exact: true }).fill("Novo nome");
      await chooseExternalOption("Avatar de Pessoa dois", "Rosa");
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
      await expect(page.locator(".expanding-card__title")).toHaveCount(0);
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
