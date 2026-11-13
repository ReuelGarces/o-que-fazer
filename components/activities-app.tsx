"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ArrowUpFromLine,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Filter,
  Info,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  readActivities,
  validateBackup,
  type Activity,
  type ActivityCategory,
  type ActivityInput,
  type ActivityStatus,
} from "@/lib/activities";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Profile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Footer from "@/components/ui/footer";
import { BackgroundGradientGlow } from "@/components/ui/background-gradient-glow";
import { Callout, type CalloutTone } from "@/components/ui/callout";
import ExpandingIconButton from "@/components/ui/expanding-icon-button";
import { ExpandingCards } from "@/components/ui/expanding-cards";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { SearchWithCategory } from "@/components/ui/search-with-category";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CategoryFilter = ActivityCategory | "Todas";
type StatusFilter = ActivityStatus | "Todos";

function ActivityDialog({
  activity,
  onClose,
  onSave,
}: {
  activity: Activity | null;
  onClose: () => void;
  onSave: (input: ActivityInput) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? "Outros");
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? "Quero fazer");
  const [imageUrl, setImageUrl] = useState(activity?.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(activity?.linkUrl ?? "");
  const [detailsOpen, setDetailsOpen] = useState(Boolean(
    activity?.description || activity?.imageUrl || activity?.linkUrl,
  ));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    setError("");
    try {
      await onSave({ title, description, category, status, imageUrl, linkUrl });
      dialogRef.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a atividade.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <dialog
      aria-labelledby="activity-dialog-title"
      className="activity-dialog"
      data-lenis-prevent=""
      onClick={(event) => {
        if (!saving && event.target === dialogRef.current) dialogRef.current.close();
      }}
      onCancel={(event) => { if (saving) event.preventDefault(); }}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      ref={dialogRef}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <h2 id="activity-dialog-title">
              {activity ? "Editar atividade" : "Nova atividade"}
            </h2>
          </div>
          <Button
            aria-label="Fechar formulário"
            disabled={saving} onClick={() => dialogRef.current?.close()}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" size={18} />
          </Button>
        </div>

        <form className="activity-form" onSubmit={submit}>
          <fieldset className="activity-form-fields" disabled={saving}>
          <label className="form-field form-field--wide" htmlFor="activity-title">
            <span>Título <span className="required-mark">*</span></span>
            <input
              autoFocus
              autoComplete="off"
              id="activity-title"
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Ler Cem Anos de Solidão"
              required
              value={title}
            />
          </label>

          <label className="form-field" htmlFor="activity-category">
            <span>Categoria</span>
            <select
              id="activity-category"
              onChange={(event) => setCategory(event.target.value as ActivityCategory)}
              value={category}
            >
              {ACTIVITY_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="form-field" htmlFor="activity-status">
            <span>Status</span>
            <select
              id="activity-status"
              onChange={(event) => setStatus(event.target.value as ActivityStatus)}
              value={status}
            >
              {ACTIVITY_STATUSES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <details
            className="optional-fields form-field--wide"
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
            open={detailsOpen}
          >
            <summary>
              <span>Adicionar detalhes <span className="optional-mark">(opcional)</span></span>
              <ChevronDown aria-hidden="true" size={16} />
            </summary>
            <div className="optional-fields__content">
              <label className="form-field" htmlFor="activity-description">
                <span>Descrição <span className="optional-mark">(opcional)</span></span>
                <textarea
                  id="activity-description"
                  maxLength={2000}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Uma nota para lembrar por que isso está na sua lista..."
                  rows={3}
                  value={description}
                />
              </label>

              <label className="form-field" htmlFor="activity-image">
                <span>URL da imagem <span className="optional-mark">(opcional)</span></span>
                <input
                  autoComplete="url"
                  id="activity-image"
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={imageUrl}
                />
                <span className="field-hint">A imagem será usada como capa do card.</span>
              </label>

              <label className="form-field" htmlFor="activity-link">
                <span>Link externo <span className="optional-mark">(opcional)</span></span>
                <input
                  autoComplete="url"
                  id="activity-link"
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={linkUrl}
                />
              </label>
            </div>
          </details>

          {error && (
            <Callout
              aria-live="assertive"
              className="form-error form-field--wide"
              icon={<AlertCircle size={17} />}
              role="alert"
              title="Não foi possível salvar"
              tone="danger"
            >
              {error}
            </Callout>
          )}

          <div className="dialog-actions form-field--wide">
            <Button disabled={saving} onClick={() => dialogRef.current?.close()} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit" variant="primary">
              <Check aria-hidden="true" size={16} />
              {saving ? "Salvando…" : activity ? "Salvar alterações" : "Adicionar à lista"}
            </Button>
          </div>
          </fieldset>
        </form>
      </div>
    </dialog>
  );
}

function ActivityStat({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof CircleHelp;
  tone: "sand" | "blue" | "green";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={`Filtrar atividades: ${label} (${value})`}
      aria-pressed={active}
      className={`stat-card${active ? " stat-card--active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className={`stat-icon stat-icon--${tone}`}>
        <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
      </span>
      <span className="stat-copy">
        <span className="stat-number">{value}</span>
        <span className="stat-label">{label}</span>
      </span>
    </button>
  );
}

export function ActivitiesApp({ profile }: { profile: Profile }) {
  const router = useRouter();
  const revisionRef = useRef(0);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<Activity[]>([]);
  const [legacyError, setLegacyError] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState<{ message: string; tone: CalloutTone } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("Todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [dialogActivity, setDialogActivity] = useState<Activity | null | undefined>();
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showNotice(message: string, tone: CalloutTone = "success") {
    setNotice({ message, tone });
  }

  useEffect(() => {
    let mounted = true;
    api<{ activities: Activity[]; revision: number }>("activities", { headers: { "x-profile-id": profile.id } })
      .then(result => { if (mounted) { setActivities(result.activities); revisionRef.current = result.revision; } })
      .catch(error => { if (mounted) setStorageError(error.message); })
      .finally(() => { if (mounted) setLoaded(true); });
    queueMicrotask(() => {
      if (!mounted) return;
      try { setLegacy(readActivities()); }
      catch (error) { setLegacyError(error instanceof Error ? error.message : "Não foi possível ler os dados antigos."); }
    });
    return () => { mounted = false; };
  }, [profile.id]);

  const filteredActivities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return activities.filter((activity) => {
      const matchesSearch = !term || activity.title.toLocaleLowerCase("pt-BR").includes(term);
      const matchesCategory = categoryFilter === "Todas" || activity.category === categoryFilter;
      const matchesStatus = statusFilter === "Todos" || activity.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [activities, categoryFilter, search, statusFilter]);

  const counts = useMemo(() => ({
    planned: activities.filter((activity) => activity.status === "Quero fazer").length,
    inProgress: activities.filter((activity) => activity.status === "Em andamento").length,
    complete: activities.filter((activity) => activity.status === "Concluído").length,
  }), [activities]);

  async function refreshList() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const result = await api<{ activities: Activity[]; revision: number }>("activities", { headers: { "x-profile-id": profile.id } });
      revisionRef.current = result.revision; setActivities(result.activities); setStorageError("");
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function write(path: string, method: string, value?: unknown) {
    if (busyRef.current) throw new Error("Aguarde a operação atual terminar.");
    busyRef.current = true; setBusy(true);
    try {
      const result = await api<{ activities: Activity[]; revision: number; imported: number; skipped: number }>(path, {
        method, headers: { "x-profile-id": profile.id, "if-match": String(revisionRef.current) },
        body: value === undefined ? undefined : JSON.stringify(value),
      });
      revisionRef.current = result.revision; setActivities(result.activities); setStorageError(""); return result;
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function saveOne(input: ActivityInput) {
    await write(dialogActivity ? `activities/${encodeURIComponent(dialogActivity.id)}` : "activities", dialogActivity ? "PATCH" : "POST", input);
    showNotice(dialogActivity ? "Atividade atualizada." : "Atividade adicionada à sua lista.");
  }
  async function changeStatus(id: string, status: ActivityStatus) {
    try { await write(`activities/${encodeURIComponent(id)}`, "PATCH", { status }); showNotice("Status atualizado."); }
    catch (cause) { showNotice(cause instanceof Error ? cause.message : "Não foi possível atualizar o status.", "danger"); }
  }
  async function importLegacy() {
    if (!window.confirm(`Importar ${legacy.length} atividades antigas para o perfil ${profile.name}? Registros idênticos serão ignorados. Os dados do navegador serão mantidos.`)) return;
    try {
      const result = await write("import-local", "POST", { activities: legacy });
      showNotice(`Importação verificada: ${result.imported} adicionadas e ${result.skipped} já existentes no perfil ${profile.name}. Os dados do navegador foram mantidos.`);
    } catch (cause) { showNotice(cause instanceof Error ? cause.message : "Não foi possível importar.", "danger"); }
  }

  function removeOne(activity: Activity, trigger: HTMLButtonElement) {
    deleteTriggerRef.current = trigger;
    setPendingDelete(activity);
  }

  async function confirmRemoveOne() {
    if (!pendingDelete) return;

    const activity = pendingDelete;
    try {
      await write(`activities/${encodeURIComponent(activity.id)}`, "DELETE");
      if (expandedId === activity.id) setExpandedId(null);
      setPendingDelete(null);
      showNotice("Atividade excluída.");
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "Não foi possível excluir a atividade.", "danger");
    }
  }

  async function exportBackup() {
    try {
      const backup = await api<import("@/lib/activities").ActivityBackup>("backup", { headers: { "x-profile-id": profile.id } });
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `o-que-quero-fazer-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showNotice(`${backup.activities.length} ${backup.activities.length === 1 ? "atividade exportada" : "atividades exportadas"}.`);
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "Não foi possível exportar o backup.", "danger");
    }
  }

  async function importBackup(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showNotice("Arquivo muito grande. Limite de 8 MB.", "danger"); input.value = ""; return; }

    try {
      const backup = validateBackup(JSON.parse(await file.text()) as unknown);
      if (!window.confirm(`O backup tem ${backup.activities.length} atividades. Substituir todas as atividades do perfil ${profile.name}? O outro perfil não será alterado.`)) return;
      await write("backup", "PUT", backup);
      showNotice("Backup importado e verificado com sucesso.");
      setExpandedId(null);
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "Não foi possível importar este arquivo.", "danger");
    } finally {
      input.value = "";
    }
  }

  const activeFilters = categoryFilter !== "Todas" || statusFilter !== "Todos" || search.trim() !== "";
  const hasActivities = loaded && !storageError && activities.length > 0;
  const NoticeIcon = notice?.tone === "danger" ? AlertCircle : notice?.tone === "info" ? Info : CheckCircle2;
  return (
    <main className="app-shell">
      <section aria-labelledby="hero-title" className="hero" id="inicio">
        <div aria-hidden="true" className="hero-grid">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
        <header className="topbar hero-topbar">
          <a aria-label="O que fazer? — início" className="brand" href="#inicio">
            <span className="brand-mark"><Compass aria-hidden="true" size={18} strokeWidth={1.7} /></span>
            <span>o que fazer<span className="brand-period">.</span></span>
          </a>
          <nav aria-label="Ações da lista" className="topbar-actions">
            <Link aria-disabled={busy} onClick={(event) => { if (busy) event.preventDefault(); }} prefetch={false} className="profile-switch" href="/profiles">{profile.name} · Trocar perfil</Link>
            <Button disabled={busy} variant="ghost" onClick={async () => {
              try { await api("logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
              catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível sair.", "danger"); }
            }}>Sair</Button>
            <InteractiveHoverButton
              className="backup-button"
              onClick={exportBackup}
              startIcon={<ArrowDownToLine aria-hidden="true" className="action-icon--export" size={15} />}
              text="Exportar"
            />
            <InteractiveHoverButton
              className="backup-button"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<ArrowUpFromLine aria-hidden="true" className="action-icon--import" size={15} />}
              text="Importar"
            />
            <input
              accept="application/json,.json"
              aria-label="Selecionar arquivo de backup JSON"
              className="sr-only"
              onChange={importBackup}
              ref={fileInputRef}
              type="file"
            />
          </nav>
        </header>
        <div className="hero-copy">
          <h1 id="hero-title" tabIndex={-1}>O que fazer?</h1>
          <p>Reúna ideias do que fazer, lugares para conhecer e coisas novas para aprender.</p>
          <Button
            className="hero-cta"
            disabled={busy || !loaded || Boolean(storageError)}
            onClick={() => setDialogActivity(null)}
            variant="primary"
          >
            <span className="hero-cta__label">Guardar uma ideia</span>
            <span className="hero-cta__mark"><ArrowUpRight aria-hidden="true" className="hero-cta__arrow hero-cta__arrow--first" size={20} /><ArrowUpRight aria-hidden="true" className="hero-cta__arrow hero-cta__arrow--second" size={20} /></span>
          </Button>
        </div>
        <a className="hero-scroll-cue" href="#lista">
          Role para explorar
          <ChevronDown aria-hidden="true" size={16} />
        </a>
      </section>

      <BackgroundGradientGlow className="content-background">
      <div className="page-main" id="lista">
      {(legacy.length > 0 || legacyError) && <Callout className="storage-notice legacy-notice" title="Ideias guardadas neste navegador" tone="info" icon={<Info size={17} />}>
        <p>{legacyError || `${legacy.length} ${legacy.length === 1 ? "atividade antiga disponível" : "atividades antigas disponíveis"}. Destino: ${profile.name}.`}</p>
        {legacy.length > 0 && <Button disabled={busy || !loaded || Boolean(storageError)} onClick={importLegacy}>Importar para {profile.name}</Button>}
        <Link prefetch={false} href="/profiles">Escolher outro perfil</Link>
      </Callout>}
      {hasActivities && (
        <section aria-label="Resumo das atividades e filtros por status" className="stats-row">
          <ActivityStat
            active={statusFilter === "Quero fazer"}
            icon={CircleHelp}
            label="Quero fazer"
            onClick={() => setStatusFilter((current) => current === "Quero fazer" ? "Todos" : "Quero fazer")}
            tone="sand"
            value={counts.planned}
          />
          <ActivityStat
            active={statusFilter === "Em andamento"}
            icon={Clock3}
            label="Em andamento"
            onClick={() => setStatusFilter((current) => current === "Em andamento" ? "Todos" : "Em andamento")}
            tone="blue"
            value={counts.inProgress}
          />
          <ActivityStat
            active={statusFilter === "Concluído"}
            icon={CheckCircle2}
            label="Concluídas"
            onClick={() => setStatusFilter((current) => current === "Concluído" ? "Todos" : "Concluído")}
            tone="green"
            value={counts.complete}
          />
        </section>
      )}

      {storageError && (
        <Callout
          aria-live="assertive"
          className="storage-notice"
          icon={<AlertCircle size={17} />}
          role="alert"
          title="Não foi possível carregar sua lista"
          tone="danger"
        >
          <p>{storageError} Tente carregar a lista novamente ou <Link href="/login">entre novamente</Link>.</p>
          <Button aria-label="Fechar aviso" onClick={() => setStorageError("")} size="icon" variant="ghost"><X aria-hidden="true" size={16} /></Button>
        </Callout>
      )}

      <section aria-labelledby="collection-heading" className="collection-section">
          <div className="section-heading">
            <div>
              <h2 id="collection-heading" tabIndex={-1}>Sua lista</h2>
              <p>Ideias para viver, aprender e realizar.</p>
            </div>
            {hasActivities && (
              <span aria-label={`${filteredActivities.length} atividades`} className="heading-count">
                {filteredActivities.length}
              </span>
            )}
            {hasActivities && (
              <ExpandingIconButton
                className="collection-add-button"
                disabled={busy || !loaded || Boolean(storageError)}
                onClick={() => setDialogActivity(null)}
                text="Adicionar ideia"
              />
            )}
          </div>
          {hasActivities && (
            <>
              <div className="filters-panel">
                <SearchWithCategory
                  allCategoryLabel="Todas as categorias"
                  allCategoryValue="Todas"
                  categories={ACTIVITY_CATEGORIES.map((categoryOption) => ({
                    label: categoryOption,
                    value: categoryOption,
                  }))}
                  category={categoryFilter}
                  onCategoryChange={(value) => setCategoryFilter(value as CategoryFilter)}
                  onClear={() => setSearch("")}
                  onSearchChange={setSearch}
                  onSubmit={() => setSearch((currentSearch) => currentSearch.trim())}
                  search={search}
                />

                <label className="status-filter-wrap">
                  <Filter aria-hidden="true" size={14} />
                  <select
                    aria-label="Filtrar por status"
                    className="status-filter"
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    value={statusFilter}
                  >
                    <option value="Todos">Todos os status</option>
                    {ACTIVITY_STATUSES.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          <div className="cards-area">
            {!loaded ? (
              <div className="loading-state"><span className="loading-dot" /> Preparando sua lista...</div>
            ) : storageError ? (
              <div className="empty-state empty-state--small">
                <span className="empty-icon"><CircleHelp aria-hidden="true" size={20} /></span>
                <div>
                  <h3>A lista está indisponível</h3>
                  <p>Verifique sua conexão e tente novamente.</p>
                </div>
                <InteractiveHoverButton
                  className="empty-import-button"
                  onClick={() => { void refreshList().catch(error => setStorageError(error.message)); }}
                  startIcon={<ArrowUpFromLine aria-hidden="true" size={15} />}
                  text="Tentar novamente"
                />
              </div>
            ) : filteredActivities.length > 0 ? (
              <>
                <ExpandingCards
                  activities={filteredActivities}
                  expandedId={expandedId && filteredActivities.some((item) => item.id === expandedId) ? expandedId : null}
                  onDelete={removeOne}
                  onEdit={(activity) => setDialogActivity(activity)}
                  onExpand={(id) => setExpandedId((current) => current === id ? null : id)}
                  onStatusChange={changeStatus}
                />
                <div className="cards-footnote">
                  <span><span className="footnote-dot" /> {activeFilters ? `${filteredActivities.length} ${filteredActivities.length === 1 ? "resultado" : "resultados"}` : `${activities.length} ${activities.length === 1 ? "ideia guardada" : "ideias guardadas"}`}</span>
                  <span>Passe o cursor ou toque em um card para ver detalhes</span>
                </div>
              </>
            ) : loaded && activities.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><Compass aria-hidden="true" size={22} /></span>
                <div>
                  <h3>Comece por algo que sempre quis fazer</h3>
                  <p>Guarde uma ideia, um lugar para conhecer ou algo novo para aprender.</p>
                </div>
                <ExpandingIconButton
                  className="empty-add-button"
                  disabled={busy || !loaded || Boolean(storageError)}
                  onClick={() => setDialogActivity(null)}
                  text="Adicionar primeira ideia"
                />
              </div>
            ) : activeFilters ? (
              <div className="empty-state empty-state--small">
                <span className="empty-icon"><Search aria-hidden="true" size={20} /></span>
                <div>
                  <h3>Nenhuma ideia encontrada</h3>
                  <p>Tente mudar os filtros ou a busca.</p>
                </div>
                <Button
                  onClick={() => { setSearch(""); setCategoryFilter("Todas"); setStatusFilter("Todos"); }}
                  size="small"
                  variant="ghost"
                >
                  Limpar filtros <ArrowRight aria-hidden="true" size={14} />
                </Button>
              </div>
            ) : null}
          </div>
      </section>

      </div>
        <Footer />
      </BackgroundGradientGlow>

      {dialogActivity !== undefined && (
        <ActivityDialog
          activity={dialogActivity}
          onClose={() => setDialogActivity(undefined)}
          onSave={saveOne}
        />
      )}
      <AlertDialog
        onOpenChange={(open) => { if (!open && !busy) setPendingDelete(null); }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent
          className="delete-confirmation"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const trigger = deleteTriggerRef.current;
            deleteTriggerRef.current = null;
            if (trigger?.isConnected) trigger.focus();
            else document.getElementById("collection-heading")?.focus();
          }}
        >
          <AlertDialogHeader className="delete-confirmation__header">
            <span aria-hidden="true" className="delete-confirmation__icon">
              <Trash2 size={21} strokeWidth={1.8} />
            </span>
            <div className="delete-confirmation__copy">
              <AlertDialogTitle>Excluir esta atividade?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete && (
                  <>
                    A atividade “{pendingDelete.title}” será removida da sua lista. Para recuperá-la depois, será necessário importar um backup anterior.
                  </>
                )}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="delete-confirmation__actions">
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void confirmRemoveOne(); }}>
              {busy ? "Excluindo…" : "Excluir atividade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {notice && (
        <Callout
          aria-live={notice.tone === "danger" ? "assertive" : "polite"}
          className="toast-note"
          icon={<NoticeIcon aria-hidden="true" size={17} />}
          role={notice.tone === "danger" ? "alert" : "status"}
          title={notice.tone === "danger" ? "A ação não foi concluída" : "Tudo certo"}
          tone={notice.tone}
        >
          <span>{notice.message}</span>
          {notice.tone === "danger" && <Button disabled={busy} variant="ghost" onClick={() => { void refreshList().then(() => showNotice("Lista atualizada. Você pode tentar novamente.")).catch(error => showNotice(error.message, "danger")); }}>Atualizar lista</Button>}
          <Button aria-label="Fechar mensagem" onClick={() => setNotice(null)} size="icon" variant="ghost">
            <X aria-hidden="true" size={15} />
          </Button>
        </Callout>
      )}
    </main>
  );
}
