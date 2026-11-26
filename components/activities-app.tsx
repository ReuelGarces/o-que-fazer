"use client";

import {
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
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  type Activity,
  type ActivityCard,
  type ActivityCategory,
  type ActivityCompletion,
  type ActivityInput,
  type ActivityStatus,
  type RecurrenceFrequency,
  currentLocalDate,
} from "@/lib/activities";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProfileOrb } from "@/components/ui/profile-orb";
import { api, type Profile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Footer from "@/components/ui/footer";
import { BackgroundGradientGlow } from "@/components/ui/background-gradient-glow";
import { Callout, type CalloutTone } from "@/components/ui/callout";
import ExpandingIconButton from "@/components/ui/expanding-icon-button";
import { ExpandingCards } from "@/components/ui/expanding-cards";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { SearchWithCategory } from "@/components/ui/search-with-category";
import { Component as Scheduler } from "@/components/ui/scheduler";
import SkyToggle from "@/components/ui/sky-toggle";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { AnimatedDropdown } from "@/components/ui/animated-dropdown";
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
const STATUS_FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: "Todos", label: "Todos os status" },
  ...ACTIVITY_STATUSES.map((status) => ({ value: status, label: status })),
];
type ActivitySnapshot = {
  revision: number;
  activities: Activity[];
  completions: ActivityCompletion[];
};

const STATUS_GROUPS = [
  { id: "inProgress", status: "Em andamento", label: "Em andamento", icon: Clock3 },
  { id: "planned", status: "Quero fazer", label: "Quero fazer", icon: CircleHelp },
  { id: "complete", status: "Concluído", label: "Concluídos", icon: CheckCircle2 },
] as const;

type StatusGroupId = (typeof STATUS_GROUPS)[number]["id"];
type StatusGroupState = Record<StatusGroupId, boolean>;

const DEFAULT_STATUS_GROUPS: StatusGroupState = {
  inProgress: true,
  planned: true,
  complete: false,
};

function statusGroupPreferenceKey(profileId: string) {
  return `o-que-fazer:status-groups:v1:${profileId}`;
}

const STATUS_GROUP_PREFERENCES_EVENT = "o-que-fazer:status-group-preferences-change";
const DEFAULT_STATUS_GROUPS_SNAPSHOT = JSON.stringify(DEFAULT_STATUS_GROUPS);
const THEME_PREFERENCE_KEY = "o-que-fazer:theme:v1";
const THEME_PREFERENCE_EVENT = "o-que-fazer:theme-preference-change";
type ThemePreference = "light" | "dark";
let themePreferenceFallback: ThemePreference = "light";

function readThemePreferenceSnapshot(key: string): ThemePreference {
  try {
    const preference = window.localStorage.getItem(key);
    if (preference === "light" || preference === "dark") return preference;
  } catch {
    // Use the in-memory preference if browser storage is unavailable.
  }
  return themePreferenceFallback;
}

function applyThemePreference(preference: ThemePreference) {
  if (preference === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function subscribeThemePreferences(key: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    themePreferenceFallback = event.key === null || event.newValue !== "dark" ? "light" : "dark";
    applyThemePreference(themePreferenceFallback);
    onChange();
  };
  const onSameTabChange = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string; preference: ThemePreference }>).detail;
    if (detail?.key !== key) return;
    themePreferenceFallback = detail.preference;
    applyThemePreference(themePreferenceFallback);
    onChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_PREFERENCE_EVENT, onSameTabChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_PREFERENCE_EVENT, onSameTabChange);
  };
}

function writeThemePreference(key: string, preference: ThemePreference) {
  themePreferenceFallback = preference;
  applyThemePreference(preference);
  try {
    window.localStorage.setItem(key, preference);
  } catch {
    // The current page still changes theme when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_EVENT, { detail: { key, preference } }));
}

function readStatusGroupPreferenceSnapshot(key: string) {
  try {
    return window.localStorage.getItem(key) ?? DEFAULT_STATUS_GROUPS_SNAPSHOT;
  } catch {
    return DEFAULT_STATUS_GROUPS_SNAPSHOT;
  }
}

function subscribeStatusGroupPreferences(key: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onChange();
  };
  const onSameTabChange = (event: Event) => {
    if ((event as CustomEvent<{ key: string }>).detail?.key === key) onChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(STATUS_GROUP_PREFERENCES_EVENT, onSameTabChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STATUS_GROUP_PREFERENCES_EVENT, onSameTabChange);
  };
}

function parseStatusGroupPreferences(snapshot: string): StatusGroupState {
  const preferences = { ...DEFAULT_STATUS_GROUPS };
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (typeof parsed === "object" && parsed !== null) {
      for (const group of STATUS_GROUPS) {
        const value = (parsed as Record<string, unknown>)[group.id];
        if (typeof value === "boolean") preferences[group.id] = value;
      }
    }
  } catch {
    // Keep the defaults if the stored value is invalid.
  }
  return preferences;
}

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
  const [isRepeating, setIsRepeating] = useState(activity ? activity.recurrence !== "none" : false);
  const [repeatInterval, setRepeatInterval] = useState<Exclude<RecurrenceFrequency, "none">>(
    activity?.recurrence === "none" ? "weekly" : activity?.recurrence ?? "weekly",
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(activity?.recurrenceInterval ?? 1);
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
      await onSave({
        title,
        description,
        category,
        status,
        imageUrl,
        linkUrl,
        recurrence: isRepeating ? repeatInterval : "none",
        recurrenceInterval: isRepeating && repeatInterval === "custom" ? recurrenceInterval : null,
      });
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
            <AnimatedDropdown<ActivityCategory>
              ariaLabel="Categoria da atividade"
              className="form-field__select"
              id="activity-category"
              onChange={setCategory}
              options={ACTIVITY_CATEGORIES}
              value={category}
            />
          </label>

          <label className="form-field" htmlFor="activity-status">
            <span>Status</span>
            <AnimatedDropdown<ActivityStatus>
              ariaLabel="Status da atividade"
              className="form-field__select"
              id="activity-status"
              onChange={setStatus}
              options={ACTIVITY_STATUSES}
              value={status}
            />
          </label>

          <Scheduler
            isRepeating={isRepeating}
            recurrenceInterval={recurrenceInterval}
            repeatInterval={repeatInterval}
            setRecurrenceInterval={setRecurrenceInterval}
            setRepeatInterval={setRepeatInterval}
            toggleRepeating={() => setIsRepeating((current) => !current)}
          />

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
                <span className="field-hint">A categoria define a capa padrão. Informe uma URL para usar outra imagem.</span>
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
  return <ActivitiesAppContent key={profile.id} profile={profile} />;
}

function ActivitiesAppContent({ profile }: { profile: Profile }) {
  const router = useRouter();
  const revisionRef = useRef(0);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completions, setCompletions] = useState<ActivityCompletion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState<{ message: string; tone: CalloutTone } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("Todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const groupPreferenceKey = statusGroupPreferenceKey(profile.id);
  const subscribeToGroupPreferences = useCallback(
    (onChange: () => void) => subscribeStatusGroupPreferences(groupPreferenceKey, onChange),
    [groupPreferenceKey],
  );
  const getGroupPreferencesSnapshot = useCallback(
    () => readStatusGroupPreferenceSnapshot(groupPreferenceKey),
    [groupPreferenceKey],
  );
  const groupPreferencesSnapshot = useSyncExternalStore(
    subscribeToGroupPreferences,
    getGroupPreferencesSnapshot,
    () => DEFAULT_STATUS_GROUPS_SNAPSHOT,
  );
  const subscribeToThemePreferences = useCallback(
    (onChange: () => void) => subscribeThemePreferences(THEME_PREFERENCE_KEY, onChange),
    [],
  );
  const getThemePreferenceSnapshot = useCallback(
    () => readThemePreferenceSnapshot(THEME_PREFERENCE_KEY),
    [],
  );
  const themePreferenceSnapshot = useSyncExternalStore(
    subscribeToThemePreferences,
    getThemePreferenceSnapshot,
    () => "light" as ThemePreference,
  );
  const nightMode = themePreferenceSnapshot === "dark";
  const storedGroupDefaults = useMemo(
    () => parseStatusGroupPreferences(groupPreferencesSnapshot),
    [groupPreferencesSnapshot],
  );
  const [optimisticGroupDefaults, setOptimisticGroupDefaults] = useState<{
    sourceSnapshot: string;
    values: StatusGroupState;
  } | null>(null);
  const groupDefaults = optimisticGroupDefaults?.sourceSnapshot === groupPreferencesSnapshot
    ? optimisticGroupDefaults.values
    : storedGroupDefaults;
  const [openGroupOverrides, setOpenGroupOverrides] = useState<Partial<StatusGroupState>>({});
  const openGroups = { ...groupDefaults, ...openGroupOverrides };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [dialogActivity, setDialogActivity] = useState<Activity | null | undefined>();
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  function showNotice(message: string, tone: CalloutTone = "success") {
    setNotice({ message, tone });
  }

  function changeTheme(enabled: boolean) {
    writeThemePreference(THEME_PREFERENCE_KEY, enabled ? "dark" : "light");
  }

  useEffect(() => {
    let mounted = true;
    api<ActivitySnapshot>("activities", { headers: { "x-profile-id": profile.id, "x-local-date": currentLocalDate() } })
      .then(result => { if (mounted) { setActivities(result.activities); setCompletions(result.completions); revisionRef.current = result.revision; } })
      .catch(error => { if (mounted) setStorageError(error.message); })
      .finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, [profile.id]);

  const { filteredActivities, completedCards } = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const matchesTextAndCategory = (activity: Activity) => {
      const matchesSearch = !term || activity.title.toLocaleLowerCase("pt-BR").includes(term);
      const matchesCategory = categoryFilter === "Todas" || activity.category === categoryFilter;
      return matchesSearch && matchesCategory;
    };
    const completionIds = new Set(completions.map((completion) => completion.activityId));
    const activityById = new Map(activities.map((activity) => [activity.id, activity]));
    const completed: ActivityCard[] = [
      ...completions.flatMap((completion) => {
        const activity = activityById.get(completion.activityId);
        if (!activity) return [];
        return [{
          ...activity,
          status: "Concluído" as const,
          cardKey: `completion:${completion.id}`,
          completionId: completion.id,
          completedOn: completion.completedOn,
          isHistory: true,
          canReopen: activity.status === "Concluído",
        }];
      }),
      ...activities
        .filter((activity) => activity.status === "Concluído" && !completionIds.has(activity.id))
        .map((activity) => ({ ...activity, canReopen: true })),
    ].filter((activity) => matchesTextAndCategory(activity));

    const active = activities.filter((activity) =>
      activity.status !== "Concluído" &&
      (statusFilter === "Todos" || activity.status === statusFilter) &&
      matchesTextAndCategory(activity),
    );
    const filteredCompleted = statusFilter === "Todos" || statusFilter === "Concluído"
      ? completed
      : [];
    return { filteredActivities: active, completedCards: filteredCompleted };
  }, [activities, categoryFilter, completions, search, statusFilter]);

  const visibleStatusGroups = useMemo(() => STATUS_GROUPS.map((group) => ({
    ...group,
    activities: (group.id === "complete"
      ? completedCards
      : filteredActivities.filter((activity) => activity.status === group.status)) as ActivityCard[],
  })).filter((group) =>
    group.activities.length > 0 || (group.id === "complete" && statusFilter === "Concluído"),
  ), [completedCards, filteredActivities, statusFilter]);

  const counts = useMemo(() => ({
    planned: activities.filter((activity) => activity.status === "Quero fazer").length,
    inProgress: activities.filter((activity) => activity.status === "Em andamento").length,
    complete: activities.filter((activity) => activity.status === "Concluído").length,
  }), [activities]);

  function chooseStatusFilter(value: StatusFilter) {
    setStatusFilter(value);
    const group = STATUS_GROUPS.find((item) => item.status === value);
    if (group) setOpenGroupOverrides((current) => ({ ...current, [group.id]: true }));
  }

  function toggleStatusFilter(value: ActivityStatus) {
    chooseStatusFilter(statusFilter === value ? "Todos" : value);
  }

  async function refreshList() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const result = await api<ActivitySnapshot>("activities", { headers: { "x-profile-id": profile.id, "x-local-date": currentLocalDate() } });
      revisionRef.current = result.revision; setActivities(result.activities); setCompletions(result.completions); setStorageError("");
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function write(path: string, method: string, value?: unknown) {
    if (busyRef.current) throw new Error("Aguarde a operação atual terminar.");
    busyRef.current = true; setBusy(true);
    try {
      const result = await api<ActivitySnapshot & { imported: number; skipped: number }>(path, {
        method, headers: { "x-profile-id": profile.id, "x-local-date": currentLocalDate(), "if-match": String(revisionRef.current) },
        body: value === undefined ? undefined : JSON.stringify(value),
      });
      revisionRef.current = result.revision; setActivities(result.activities); setCompletions(result.completions); setStorageError(""); return result;
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function saveOne(input: ActivityInput) {
    await write(dialogActivity ? `activities/${encodeURIComponent(dialogActivity.id)}` : "activities", dialogActivity ? "PATCH" : "POST", input);
    showNotice(dialogActivity ? "Atividade atualizada." : "Atividade adicionada à sua lista.");
  }
  async function changeStatus(activity: ActivityCard, status: ActivityStatus) {
    try {
      await write(`activities/${encodeURIComponent(activity.id)}`, "PATCH", {
        status,
        ...(activity.completionId ? { completionId: activity.completionId } : {}),
      });
      const destination = STATUS_GROUPS.find((group) => group.status === status);
      if (destination) setOpenGroupOverrides((current) => ({ ...current, [destination.id]: true }));
      showNotice("Status atualizado.");
    }
    catch (cause) { showNotice(cause instanceof Error ? cause.message : "Não foi possível atualizar o status.", "danger"); }
  }
  function updateGroupDefault(groupId: StatusGroupId, openByDefault: boolean) {
    const next = { ...groupDefaults, [groupId]: openByDefault };
    setOptimisticGroupDefaults({ sourceSnapshot: groupPreferencesSnapshot, values: next });
    setOpenGroupOverrides((current) => ({ ...current, [groupId]: openByDefault }));
    try {
      window.localStorage.setItem(groupPreferenceKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(STATUS_GROUP_PREFERENCES_EVENT, { detail: { key: groupPreferenceKey } }));
    } catch {
      showNotice("Não foi possível salvar a preferência neste navegador.", "info");
    }
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

  const activeFilters = categoryFilter !== "Todas" || statusFilter !== "Todos" || search.trim() !== "";
  const hasActivities = loaded && !storageError && activities.length > 0;
  const filteredCount = filteredActivities.length + completedCards.length;
  const showStatusGroups = filteredCount > 0 || statusFilter === "Concluído";
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
            <div className="profile-control">
              <ProfileOrb avatar={profile.avatar} size={42} />
              <DropdownMenu
                className="profile-menu"
                disabled={busy}
                label={`Preferências de ${profile.name}`}
                trigger={(
                  <>
                    <span className="profile-menu__name">{profile.name}</span>
                    <span className="profile-menu__chevron"><ChevronDown aria-hidden="true" size={16} /></span>
                  </>
                )}
                triggerClassName="profile-menu__trigger"
              >
                <div className="profile-menu__content">
                  <div className="profile-menu__theme-row">
                    <div className="profile-menu__theme-copy">
                      <strong>Aparência</strong>
                      <span>Modo noturno</span>
                    </div>
                    <SkyToggle checked={nightMode} onChange={changeTheme} />
                  </div>
                  <div aria-hidden="true" className="profile-menu__divider" />
                  <details className="status-defaults profile-menu__defaults">
                    <summary>
                      <span><SlidersHorizontal aria-hidden="true" size={15} /> Abertura padrão</span>
                      <ChevronDown aria-hidden="true" size={16} />
                    </summary>
                    <div className="status-defaults__content">
                      <p>Escolha quais grupos começam abertos quando você voltar à lista.</p>
                      <div className="status-defaults__options">
                        {STATUS_GROUPS.map((group) => {
                          const Icon = group.icon;
                          return (
                            <label className="status-defaults__option" key={group.id}>
                              <span className={`status-defaults__icon status-defaults__icon--${group.id}`}>
                                <Icon aria-hidden="true" size={15} />
                              </span>
                              <span className="status-defaults__label">{group.label}</span>
                              <span className="status-defaults__hint">Abrir por padrão</span>
                              <input
                                aria-label={`Abrir ${group.label} por padrão`}
                                checked={groupDefaults[group.id]}
                                onChange={(event) => updateGroupDefault(group.id, event.target.checked)}
                                role="switch"
                                type="checkbox"
                              />
                              <span aria-hidden="true" className="status-defaults__switch" />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                  <div aria-hidden="true" className="profile-menu__divider" />
                  <Link className="profile-menu__link" href="/profiles" prefetch={false}>
                    <span>Trocar perfil</span>
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </DropdownMenu>
            </div>
            <Button disabled={busy} variant="ghost" onClick={async () => {
              try { await api("logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
              catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível sair.", "danger"); }
            }}>Sair</Button>
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
      {hasActivities && (
        <section aria-label="Resumo das atividades e filtros por status" className="stats-row">
          <ActivityStat
            active={statusFilter === "Quero fazer"}
            icon={CircleHelp}
            label="Quero fazer"
            onClick={() => toggleStatusFilter("Quero fazer")}
            tone="sand"
            value={counts.planned}
          />
          <ActivityStat
            active={statusFilter === "Em andamento"}
            icon={Clock3}
            label="Em andamento"
            onClick={() => toggleStatusFilter("Em andamento")}
            tone="blue"
            value={counts.inProgress}
          />
          <ActivityStat
            active={statusFilter === "Concluído"}
            icon={CheckCircle2}
            label="Concluídas"
            onClick={() => toggleStatusFilter("Concluído")}
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
              <span aria-label={`${filteredCount} atividades`} className="heading-count">
                {filteredCount}
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

                <div className="status-filter-wrap">
                  <AnimatedDropdown<StatusFilter>
                    ariaLabel="Filtrar por status"
                    className="status-filter"
                    leadingIcon={Filter}
                    onChange={chooseStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    value={statusFilter}
                  />
                </div>
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
            ) : showStatusGroups ? (
              <>
                <div aria-label="Atividades por status" className="activity-status-groups">
                  {visibleStatusGroups.map((group) => {
                    const Icon = group.icon;
                    return (
                      <details
                        className={`activity-status-group activity-status-group--${group.id}`}
                        key={group.id}
                        onToggle={(event) => {
                          const isOpen = event.currentTarget.open;
                          setOpenGroupOverrides((current) => current[group.id] === isOpen
                            ? current
                            : { ...current, [group.id]: isOpen },
                          );
                        }}
                        open={openGroups[group.id]}
                      >
                        <summary>
                          <span className={`activity-status-group__icon activity-status-group__icon--${group.id}`}>
                            <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                          </span>
                          <span className="activity-status-group__copy">
                            <span className="activity-status-group__title">{group.label}</span>
                            <span className="activity-status-group__count">
                              {group.activities.length} {group.activities.length === 1 ? "atividade" : "atividades"}
                            </span>
                          </span>
                          <ChevronDown aria-hidden="true" className="activity-status-group__chevron" size={17} />
                        </summary>
                        <div className="activity-status-group__content">
                          {group.activities.length > 0 ? (
                            <ExpandingCards
                              activities={group.activities}
                              ariaLabel={`Atividades: ${group.label}`}
                              expandedId={expandedId && group.activities.some((item) => (item.cardKey ?? item.id) === expandedId) ? expandedId : null}
                              onDelete={removeOne}
                              onEdit={(activity) => setDialogActivity(activities.find((item) => item.id === activity.id) ?? activity)}
                              onExpand={(id) => setExpandedId((current) => current === id ? null : id)}
                              onStatusChange={changeStatus}
                            />
                          ) : (
                            <div className="empty-state empty-state--small">
                              <span className="empty-icon"><Search aria-hidden="true" size={20} /></span>
                              <div>
                                <h3>Nenhuma ideia encontrada</h3>
                                <p>Tente mudar os filtros ou a busca.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
                {filteredCount > 0 && (
                  <div className="cards-footnote">
                    <span><span className="footnote-dot" /> {activeFilters ? `${filteredCount} ${filteredCount === 1 ? "resultado" : "resultados"}` : `${activities.length} ${activities.length === 1 ? "ideia guardada" : "ideias guardadas"}`}</span>
                    <span>Passe o cursor ou toque em um card para ver detalhes</span>
                  </div>
                )}
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
                    A atividade “{pendingDelete.title}” será removida da sua lista. Essa ação não pode ser desfeita.
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
