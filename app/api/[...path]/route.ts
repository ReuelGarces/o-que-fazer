import {
  authenticated,
  createSession,
  logout,
  selectedProfile,
} from "@/lib/server/auth";
import { authenticate } from "@/lib/server/credentials";
import {
  editProfile,
  listProfiles,
  mutate,
  ownedProfile,
  snapshot,
} from "@/lib/server/store";
import { AppError } from "@/lib/server/errors";
import {
  currentLocalDate,
  isDateOnly,
  makeBackup,
  ValidationError,
} from "@/lib/activities";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 8 * 1024 * 1024;
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("Envie JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Conteúdo ausente.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new AppError("Arquivo muito grande. Limite de 8 MB.", 413);
      }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("JSON inválido.");
  }
}
function csrf(request: Request) {
  const configured = process.env.APP_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configured)
    throw new Error("Configure APP_ORIGIN.");
  const origin = configured
    ? new URL(configured).origin
    : new URL(request.url).origin;
  if (
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError("Origem da requisição inválida.", 403);
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function localDate(request: Request) {
  const supplied = request.headers.get("x-local-date");
  return isDateOnly(supplied) ? supplied : currentLocalDate();
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path.join("/");
    const method = request.method;
    if (method !== "GET") csrf(request);
    if (path === "login" && method === "POST") {
      const input = await body(request);
      const account = await authenticate(input.username, input.password);
      await createSession(account.id);
      return json({ ok: true });
    }
    if (path === "logout" && method === "POST") {
      await logout();
      return json({ ok: true });
    }
    const current = await authenticated();
    if (path === "profiles" && method === "GET")
      return json({
        profiles: listProfiles(current.accountId),
        selected: current.profileId,
      });
    if (path === "profiles/select" && method === "POST") {
      const input = await body(request);
      if (typeof input.profileId !== "string")
        throw new AppError("Selecione um perfil.");
      ownedProfile(current.accountId, input.profileId);
      current.profileId = input.profileId;
      await current.save();
      return json({ ok: true });
    }
    if (path.startsWith("profiles/") && method === "PATCH") {
      editProfile(current.accountId, path.slice(9), await body(request));
      return json({ profiles: listProfiles(current.accountId) });
    }
    const active = await selectedProfile(request.headers.get("x-profile-id"));
    const today = localDate(request);
    if (method === "GET" && path === "activities")
      return json(snapshot(active.accountId, active.profileId, today));
    if (method === "GET" && path === "backup") {
      const state = snapshot(active.accountId, active.profileId, today);
      return json(makeBackup(state.activities, state.completions));
    }
    const revisionHeader = request.headers.get("if-match");
    const revision =
      revisionHeader && /^\d+$/.test(revisionHeader)
        ? Number(revisionHeader)
        : -1;
    const activityId = path.startsWith("activities/")
      ? path.slice(11)
      : undefined;
    if (path === "activities" && method === "POST")
      return json(
        mutate(
          active.accountId,
          active.profileId,
          revision,
          "create",
          await body(request),
          undefined,
          today,
        ),
      );
    if (activityId && (method === "PATCH" || method === "DELETE"))
      return json(
        mutate(
          active.accountId,
          active.profileId,
          revision,
          method === "PATCH" ? "update" : "delete",
          method === "PATCH" ? await body(request) : null,
          activityId,
          today,
        ),
      );
    if (path === "backup" && method === "PUT")
      return json(
        mutate(
          active.accountId,
          active.profileId,
          revision,
          "replace",
          await body(request),
          undefined,
          today,
        ),
      );
    if (path === "import-local" && method === "POST") {
      const input = await body(request);
      return json(
        mutate(
          active.accountId,
          active.profileId,
          revision,
          "merge",
          input.activities,
          undefined,
          today,
        ),
      );
    }
    throw new AppError("Rota não encontrada.", 404);
  } catch (error) {
    if (error instanceof AppError || error instanceof ValidationError)
      return json(
        { error: error.message },
        error instanceof AppError ? error.status : 400,
      );
    return json(
      {
        error:
          "Não foi possível concluir a operação. Verifique a configuração do servidor e tente novamente.",
      },
      500,
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as PUT,
};
