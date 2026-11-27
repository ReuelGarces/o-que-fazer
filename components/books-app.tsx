"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, GripVertical, Plus, Pencil, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, type Profile } from "@/lib/api";
import { currentLocalDate, type Activity, type ActivityStatus } from "@/lib/activities";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@/components/ui/kanban";
import { WavesBackground } from "@/components/ui/waves-background";
import { AnimatedDropdown } from "@/components/ui/animated-dropdown";

const COLUMNS = [
  { id: "Em andamento", title: "Lendo" },
  { id: "Quero fazer", title: "Quero ler" },
  { id: "Concluído", title: "Lido" },
] as const;
const STATUS_OPTIONS = COLUMNS.map(({ id, title }) => ({ value: id, label: title }));
type Snapshot = { revision: number; activities: Activity[] };
type Draft = { id?: string; title: string; description: string; status: ActivityStatus; imageUrl: string; linkUrl: string };
const makeDraft = (status: ActivityStatus = "Quero fazer"): Draft => ({ title: "", description: "", status, imageUrl: "", linkUrl: "" });
const control = "rounded-md border border-[#e2d6df] bg-white px-3 py-2 text-sm text-[#1A1423] focus-visible:outline-2 focus-visible:outline-[#B75D69] disabled:opacity-50";
const action = "inline-flex items-center justify-center gap-2 rounded-md border border-[#e2d6df] bg-white px-3 py-2 text-sm font-medium text-[#1A1423] shadow-xs hover:bg-[#FFF5EB] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#B75D69]";

function BookSummary({ book }: { book: Activity }) {
  return <div className="flex min-w-0 items-start gap-3">
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[#EACDC2] text-[#1A1423]">
      {book.imageUrl ? (
        // User-entered remote URLs are already validated by the activity API.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : <BookOpen size={20} aria-hidden="true" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-medium">{book.title}</p>
      {book.description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-[#63565e]">{book.description}</p>}
    </div>
  </div>;
}

export function BooksApp({ profile }: { profile: Profile }) {
  const [state, setState] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  const headers = useCallback(() => ({ "x-profile-id": profile.id, "x-local-date": currentLocalDate() }), [profile.id]);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api<Snapshot>("activities", { headers: headers() });
      if (mounted.current) setState(next);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Não foi possível carregar os livros.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [headers]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    pending.current = true;
    api<Snapshot>("activities", { headers: headers() })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar os livros.");
      })
      .finally(() => {
        if (!cancelled) {
          pending.current = false;
          setBusy(false);
        }
      });
    return () => { cancelled = true; mounted.current = false; };
  }, [headers]);

  const books = state?.activities.filter((activity) => activity.category === "Livros") ?? [];

  async function mutate(path: string, method: string, body?: unknown) {
    if (!state || pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await api<Snapshot>(path, {
        method,
        headers: { ...headers(), "if-match": String(state.revision) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (mounted.current) {
        setState(next);
        setNotice("Biblioteca atualizada.");
      }
      return true;
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function move(id: string, status: string) {
    const book = books.find((item) => item.id === id);
    if (!book || book.status === status || !COLUMNS.some((column) => column.id === status)) return;
    await mutate("activities/" + encodeURIComponent(id), "PATCH", { status });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const { id, ...input } = draft;
    const saved = id
      ? await mutate("activities/" + encodeURIComponent(id), "PATCH", input)
      : await mutate("activities", "POST", { ...input, category: "Livros", recurrence: "none", recurrenceInterval: null });
    if (saved) setDraft(null);
  }

  async function remove(book: Activity) {
    if (!window.confirm('Excluir "' + book.title + '" da biblioteca e da lista de atividades?')) return;
    await mutate("activities/" + encodeURIComponent(book.id), "DELETE");
  }

  return <main className="relative isolate min-h-svh flex-1 bg-[#1A1423] text-[#1A1423]">
    <WavesBackground />
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/60 bg-[#FFF5EB]/95 p-3 shadow-xs">
        <Link href="/" prefetch={false} className={action}><ArrowLeft size={16} aria-hidden="true" /> O que fazer?</Link>
        <span className="text-sm font-medium">{profile.name}</span>
      </header>
      <div className="my-8 flex flex-wrap items-end justify-between gap-4">
        <div className="rounded-md bg-[#1A1423]/90 px-5 py-4 text-[#FFF5EB]">
          <p className="text-xs font-medium tracking-widest uppercase text-[#EACDC2]">Minha biblioteca</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">Livros</h1>
          <p className="mt-2 text-sm">Organize suas próximas leituras.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={() => void refresh()} disabled={busy} aria-label="Atualizar biblioteca"><RefreshCw size={16} aria-hidden="true" /></button>
          <button type="button" onClick={() => setDraft(makeDraft())} disabled={!state || busy}
            className="inline-flex items-center gap-2 rounded-md bg-[#1A1423] px-4 py-2.5 text-sm font-medium text-[#FFF5EB] shadow-xs ring-1 ring-white/50 hover:bg-[#35283b] disabled:opacity-50">
            <Plus size={18} aria-hidden="true" /> Novo livro
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-white p-3 text-sm text-red-800">{error}</p>}
      <p role="status" className="sr-only">{busy ? "Atualizando biblioteca." : notice}</p>
      {draft && <form onSubmit={save} className="mb-5 grid gap-3 rounded-md border border-[#e2d6df] bg-[#FFF5EB] p-4 shadow-xs sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">{draft.id ? "Editar livro" : "Cadastrar livro"}</h2>
        <label className="grid gap-1 text-sm font-medium">Título<input autoFocus className={control} required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-medium" htmlFor="book-status">
          Status
          <AnimatedDropdown<ActivityStatus>
            id="book-status"
            ariaLabel="Status do livro"
            className={control + " w-full"}
            disabled={busy}
            options={STATUS_OPTIONS}
            value={draft.status}
            onChange={(status) => setDraft({ ...draft, status })}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">Autor e anotações<textarea className={control} rows={3} maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-medium">URL da capa (opcional)<input className={control} type="url" maxLength={4096} value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-medium">Link externo (opcional)<input className={control} type="url" maxLength={4096} value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} /></label>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <button type="button" className={action} disabled={busy} onClick={() => setDraft(null)}>Cancelar</button>
          <button type="submit" className={action + " !bg-[#1A1423] !text-white"} disabled={busy || !draft.title.trim()}>Salvar livro</button>
        </div>
      </form>}
      {!state && !error && <p className="rounded-md bg-[#FFF5EB] p-4 text-sm">Carregando livros…</p>}
      {state && <Kanban onMove={(id, status) => void move(id, status)}>
        <KanbanBoard className="gap-5">
          {COLUMNS.map((column) => {
            const items = books.filter((book) => book.status === column.id);
            return <KanbanColumn key={column.id} value={column.id}
              className="min-h-64 rounded-md border border-[#e2d6df] bg-[#FFF5EB]/95 p-2.5 shadow-xs transition-colors data-[over=true]:border-[#B75D69] data-[over=true]:ring-2 data-[over=true]:ring-[#B75D69]">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5"><h2 className="text-sm font-semibold">{column.title}</h2>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#EACDC2] px-1.5 text-xs font-medium tabular-nums">{items.length}</span></div>
                <button type="button" disabled={busy} className="rounded p-1 hover:bg-[#EACDC2]" aria-label={"Adicionar livro em " + column.title} onClick={() => setDraft(makeDraft(column.id))}><Plus size={16} aria-hidden="true" /></button>
              </div>
              <KanbanColumnContent className="gap-2.5 p-0.5">
                {!items.length && <p className="rounded-md border border-dashed border-[#cdbdc5] p-4 text-center text-xs text-[#63565e]">Arraste um livro para cá.</p>}
                {items.map((book) => <KanbanItem key={book.id} value={book.id} disabled={busy}>
                  <article className="rounded-md border border-[#e2d6df] bg-white p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-1.5">
                      <BookSummary book={book} />
                      <KanbanItemHandle label={"Arrastar " + book.title} disabled={busy}><GripVertical size={16} aria-hidden="true" /></KanbanItemHandle>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <AnimatedDropdown<ActivityStatus>
                        ariaLabel={"Status de " + book.title}
                        disabled={busy}
                        className="max-w-full rounded border border-[#e2d6df] bg-white px-2 py-1 text-xs"
                        options={STATUS_OPTIONS}
                        value={book.status}
                        onChange={(status) => void move(book.id, status)}
                      />
                      <div className="flex items-center gap-1">
                        {book.linkUrl && <a href={book.linkUrl} target="_blank" rel="noreferrer noopener" aria-label={"Abrir link de " + book.title} className="rounded p-1 hover:bg-[#FFF5EB]"><ExternalLink size={14} /></a>}
                        <button type="button" disabled={busy} className="rounded p-1 hover:bg-[#FFF5EB]" aria-label={"Editar " + book.title} onClick={() => setDraft({ id: book.id, title: book.title, description: book.description, status: book.status, imageUrl: book.imageUrl, linkUrl: book.linkUrl })}><Pencil size={14} /></button>
                        <button type="button" disabled={busy} className="rounded p-1 text-red-700 hover:bg-red-50" aria-label={"Excluir " + book.title} onClick={() => void remove(book)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </article>
                </KanbanItem>)}
              </KanbanColumnContent>
            </KanbanColumn>;
          })}
        </KanbanBoard>
        <KanbanOverlay>{(id) => {
          const book = books.find((item) => item.id === id);
          return book ? <div className="rounded-md border border-[#e2d6df] bg-white p-3 shadow-lg"><BookSummary book={book} /></div> : null;
        }}</KanbanOverlay>
      </Kanban>}
    </div>
  </main>;
}
