export class ValidationError extends Error {}

export const ACTIVITY_STORAGE_KEY = "o-que-quero-fazer:activities:v1";

export const ACTIVITY_CATEGORIES = [
  "Livros",
  "Filmes e séries",
  "Cursos",
  "Projetos",
  "Lugares",
  "Outros",
] as const;

export const ACTIVITY_STATUSES = [
  "Quero fazer",
  "Em andamento",
  "Concluído",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

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
};

export type ActivityInput = Pick<
  Activity,
  "title" | "description" | "category" | "status" | "imageUrl" | "linkUrl"
>;

export type ActivityBackup = {
  version: 1;
  exportedAt: string;
  activities: Activity[];
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

export function validateBackup(value: unknown): ActivityBackup {
  if (!isRecord(value) || value.version !== 1 || !isIsoDate(value.exportedAt)) {
    throw new ValidationError("Este arquivo não é um backup compatível do O Que Quero Fazer.");
  }

  return {
    version: 1,
    exportedAt: value.exportedAt,
    activities: validateActivityRecords(value.activities),
  };
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

/** Validate untrusted input using the same contract as backup records. */
export function validateActivityInput(value: unknown): ActivityInput {
  if (!isRecord(value)) throw new ValidationError("Atividade inválida.");
  const now = new Date().toISOString();
  const record = validateActivity({ ...value, id: "input", createdAt: now, updatedAt: now });
  return { title: record.title, description: record.description.trim(), category: record.category,
    status: record.status, imageUrl: record.imageUrl, linkUrl: record.linkUrl };
}

export function makeBackup(activities: Activity[]): ActivityBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activities: validateActivityRecords(activities),
  };
}
