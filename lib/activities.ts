export class ValidationError extends Error {}

export const ACTIVITY_STORAGE_KEY = "o-que-quero-fazer:activities:v1";

export const ACTIVITY_CATEGORIES = [
  "Livros",
  "Filmes e séries",
  "Cursos",
  "Projetos",
  "Lugares",
  "Anotações e observações",
  "Outros",
] as const;

export const ACTIVITY_STATUSES = [
  "Quero fazer",
  "Em andamento",
  "Concluído",
] as const;

export const RECURRENCE_FREQUENCIES = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "custom",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type Activity = {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  status: ActivityStatus;
  imageUrl: string;
  linkUrl: string;
  createdAt: string;
  updatedAt: string;
  recurrence: RecurrenceFrequency;
  recurrenceInterval: number | null;
  nextOccurrenceOn: string | null;
  recurrenceAnchorDay: number | null;
};

export type ActivityCard = Activity & {
  cardKey?: string;
  completionId?: string | null;
  completedOn?: string | null;
  isHistory?: boolean;
  canReopen?: boolean;
};

export type ActivityInput = Pick<
  Activity,
  | "title"
  | "description"
  | "category"
  | "status"
  | "imageUrl"
  | "linkUrl"
  | "recurrence"
  | "recurrenceInterval"
>;

export type ActivityCompletion = {
  id: string;
  activityId: string;
  completedOn: string;
  completedAt: string;
  reopenedAt: string | null;
};

export type ActivityBackup = {
  version: 2;
  exportedAt: string;
  activities: Activity[];
  completions: ActivityCompletion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    value.includes("T")
  );
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function currentLocalDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateOptionalUrl(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(`O campo ${fieldName} precisa ser um texto.`);
  }
  if (value.length > 4096) throw new ValidationError(`O campo ${fieldName} é muito longo.`);
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new ValidationError();
    }
    return url.toString();
  } catch {
    throw new ValidationError(`Informe uma URL válida em ${fieldName}.`);
  }
}

function validateRecurrence(value: Record<string, unknown>) {
  const recurrence = value.recurrence === undefined ? "none" : value.recurrence;
  if (!RECURRENCE_FREQUENCIES.includes(recurrence as RecurrenceFrequency)) {
    throw new ValidationError("A repetição da atividade é inválida.");
  }

  const recurrenceInterval = value.recurrenceInterval === undefined
    ? null
    : value.recurrenceInterval;
  if (recurrence === "custom") {
    if (
      !Number.isSafeInteger(recurrenceInterval) ||
      (recurrenceInterval as number) < 1 ||
      (recurrenceInterval as number) > 3650
    ) {
      throw new ValidationError("Informe um intervalo entre 1 e 3.650 dias.");
    }
  } else if (recurrenceInterval !== null) {
    throw new ValidationError("O intervalo personalizado só vale para repetição personalizada.");
  }

  const nextOccurrenceOn = value.nextOccurrenceOn === undefined
    ? null
    : value.nextOccurrenceOn;
  if (nextOccurrenceOn !== null && !isDateOnly(nextOccurrenceOn)) {
    throw new ValidationError("Uma atividade contém uma data de repetição inválida.");
  }

  const recurrenceAnchorDay = value.recurrenceAnchorDay === undefined
    ? null
    : value.recurrenceAnchorDay;
  if (
    recurrenceAnchorDay !== null &&
    (!Number.isInteger(recurrenceAnchorDay) ||
      (recurrenceAnchorDay as number) < 1 ||
      (recurrenceAnchorDay as number) > 31)
  ) {
    throw new ValidationError("O dia-base da repetição mensal é inválido.");
  }

  if (recurrence !== "monthly" && recurrenceAnchorDay !== null) {
    throw new ValidationError("O dia-base só vale para repetição mensal.");
  }
  if (recurrence === "none" && nextOccurrenceOn !== null) {
    throw new ValidationError("Uma atividade sem repetição não pode ter próxima data.");
  }

  return {
    recurrence: recurrence as RecurrenceFrequency,
    recurrenceInterval: recurrenceInterval as number | null,
    nextOccurrenceOn: nextOccurrenceOn as string | null,
    recurrenceAnchorDay: recurrenceAnchorDay as number | null,
  };
}

export function validateActivity(value: unknown): Activity {
  if (!isRecord(value)) {
    throw new ValidationError("Uma atividade do arquivo está em formato inválido.");
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) throw new ValidationError("Toda atividade precisa de um título.");
  if (title.length > 120) throw new ValidationError("O título pode ter até 120 caracteres.");
  if (!ACTIVITY_CATEGORIES.includes(value.category as ActivityCategory)) {
    throw new ValidationError("Uma atividade contém uma categoria inválida.");
  }
  if (!ACTIVITY_STATUSES.includes(value.status as ActivityStatus)) {
    throw new ValidationError("Uma atividade contém um status inválido.");
  }
  if (typeof value.description !== "string" || value.description.length > 2000) {
    throw new ValidationError("A descrição da atividade está inválida.");
  }
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 200) {
    throw new ValidationError("Uma atividade está sem identificador.");
  }
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) {
    throw new ValidationError("Uma atividade contém uma data inválida.");
  }

  const recurrence = validateRecurrence(value);
  if (value.status !== "Concluído" && recurrence.nextOccurrenceOn !== null) {
    throw new ValidationError("Uma atividade ativa não pode ter uma próxima data agendada.");
  }

  return {
    id: value.id,
    title,
    description: value.description,
    category: value.category as ActivityCategory,
    status: value.status as ActivityStatus,
    imageUrl: validateOptionalUrl(value.imageUrl, "URL da imagem"),
    linkUrl: validateOptionalUrl(value.linkUrl, "link externo"),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...recurrence,
  };
}

export function validateActivityRecords(value: unknown): Activity[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("O arquivo precisa conter uma lista de atividades.");
  }

  if (value.length > 10000) throw new ValidationError("O limite é de 10.000 atividades por importação.");
  const activities = value.map(validateActivity);
  const ids = new Set<string>();
  for (const activity of activities) {
    if (ids.has(activity.id)) {
      throw new ValidationError("O arquivo contém atividades duplicadas.");
    }
    ids.add(activity.id);
  }
  return activities;
}

export function validateActivityInput(value: unknown): ActivityInput {
  if (!isRecord(value)) throw new ValidationError("Atividade inválida.");
  const now = new Date().toISOString();
  const record = validateActivity({
    ...value,
    id: "input",
    createdAt: now,
    updatedAt: now,
    nextOccurrenceOn: null,
    recurrenceAnchorDay: null,
  });
  return {
    title: record.title,
    description: record.description.trim(),
    category: record.category,
    status: record.status,
    imageUrl: record.imageUrl,
    linkUrl: record.linkUrl,
    recurrence: record.recurrence,
    recurrenceInterval: record.recurrenceInterval,
  };
}

export function validateActivityCompletions(value: unknown): ActivityCompletion[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("O histórico de conclusões está inválido.");
  }
  if (value.length > 100000) {
    throw new ValidationError("O limite é de 100.000 ocorrências por importação.");
  }

  const ids = new Set<string>();
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.length > 200 ||
      typeof entry.activityId !== "string" ||
      !entry.activityId.trim() ||
      !isDateOnly(entry.completedOn) ||
      !isIsoDate(entry.completedAt) ||
      (entry.reopenedAt !== null && !isIsoDate(entry.reopenedAt))
    ) {
      throw new ValidationError("Uma ocorrência concluída contém dados inválidos.");
    }
    if (ids.has(entry.id)) {
      throw new ValidationError("O histórico contém ocorrências duplicadas.");
    }
    ids.add(entry.id);
    return {
      id: entry.id,
      activityId: entry.activityId,
      completedOn: entry.completedOn,
      completedAt: entry.completedAt,
      reopenedAt: entry.reopenedAt as string | null,
    };
  });
}

export function validateBackup(value: unknown): ActivityBackup {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !isIsoDate(value.exportedAt)
  ) {
    throw new ValidationError("Este arquivo não é um backup compatível do O Que Quero Fazer.");
  }

  const activities = validateActivityRecords(value.activities);
  const completions = value.version === 1
    ? []
    : validateActivityCompletions(value.completions);
  const activityIds = new Set(activities.map((activity) => activity.id));
  if (completions.some((completion) => !activityIds.has(completion.activityId))) {
    throw new ValidationError("O histórico referencia uma atividade que não está no backup.");
  }

  return { version: 2, exportedAt: value.exportedAt, activities, completions };
}

export function makeBackup(
  activities: Activity[],
  completions: ActivityCompletion[] = [],
): ActivityBackup {
  const validatedActivities = validateActivityRecords(activities);
  const validatedCompletions = validateActivityCompletions(completions);
  const activityIds = new Set(validatedActivities.map((activity) => activity.id));
  if (validatedCompletions.some((completion) => !activityIds.has(completion.activityId))) {
    throw new ValidationError("O histórico referencia uma atividade que não está no backup.");
  }
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    activities: validatedActivities,
    completions: validatedCompletions,
  };
}

export function nextOccurrenceDate(
  completedOn: string,
  recurrence: RecurrenceFrequency,
  recurrenceInterval: number | null,
  recurrenceAnchorDay: number | null = null,
): string | null {
  if (!isDateOnly(completedOn) || recurrence === "none") return null;
  const [year, month, day] = completedOn.split("-").map(Number);

  if (recurrence === "daily" || recurrence === "weekly" || recurrence === "custom") {
    const days = recurrence === "daily"
      ? 1
      : recurrence === "weekly"
        ? 7
        : recurrenceInterval;
    if (!days || !Number.isSafeInteger(days) || days < 1) return null;
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  const targetMonth = new Date(Date.UTC(year, month, 1));
  const targetYear = targetMonth.getUTCFullYear();
  const targetMonthIndex = targetMonth.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(recurrenceAnchorDay ?? day, daysInTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonthIndex, targetDay)).toISOString().slice(0, 10);
}

export function recurrenceLabel(activity: Pick<Activity, "recurrence" | "recurrenceInterval">): string | null {
  switch (activity.recurrence) {
    case "daily": return "Diário";
    case "weekly": return "Semanal";
    case "monthly": return "Mensal";
    case "custom": return `A cada ${activity.recurrenceInterval} dias`;
    default: return null;
  }
}

export function formatDateOnly(value: string): string {
  if (!isDateOnly(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function getStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/** Reads localStorage only in the browser and never initializes or rewrites data. */
export function readActivities(): Activity[] {
  const storage = getStorage();
  if (!storage) return [];

  const raw = storage.getItem(ACTIVITY_STORAGE_KEY);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Os dados locais estão corrompidos. Faça uma cópia antes de continuar.");
  }
  return validateActivityRecords(parsed);
}
