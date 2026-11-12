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
    throw new Error(`O campo ${fieldName} precisa ser um texto.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error(`Informe uma URL válida em ${fieldName}.`);
  }
}

export function validateActivity(value: unknown): Activity {
  if (!isRecord(value)) {
    throw new Error("Uma atividade do arquivo está em formato inválido.");
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) throw new Error("Toda atividade precisa de um título.");
  if (title.length > 120) throw new Error("O título pode ter até 120 caracteres.");
  if (!ACTIVITY_CATEGORIES.includes(value.category as ActivityCategory)) {
    throw new Error("Uma atividade contém uma categoria inválida.");
  }
  if (!ACTIVITY_STATUSES.includes(value.status as ActivityStatus)) {
    throw new Error("Uma atividade contém um status inválido.");
  }
  if (typeof value.description !== "string" || value.description.length > 2000) {
    throw new Error("A descrição da atividade está inválida.");
  }
  if (typeof value.id !== "string" || !value.id.trim()) {
    throw new Error("Uma atividade está sem identificador.");
  }
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) {
    throw new Error("Uma atividade contém uma data inválida.");
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
    throw new Error("O arquivo precisa conter uma lista de atividades.");
  }

  const activities = value.map(validateActivity);
  const ids = new Set<string>();
  for (const activity of activities) {
    if (ids.has(activity.id)) {
      throw new Error("O arquivo contém atividades duplicadas.");
    }
    ids.add(activity.id);
  }
  return activities;
}

export function validateBackup(value: unknown): ActivityBackup {
  if (!isRecord(value) || value.version !== 1 || !isIsoDate(value.exportedAt)) {
    throw new Error("Este arquivo não é um backup compatível do O Que Quero Fazer.");
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
    throw new Error("Os dados locais estão corrompidos. Faça uma cópia antes de continuar.");
  }
  return validateActivityRecords(parsed);
}

export function saveActivities(activities: Activity[]): void {
  const storage = getStorage();
  if (!storage) throw new Error("O armazenamento local só está disponível no navegador.");
  storage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(validateActivityRecords(activities)));
}

function normalizeInput(input: ActivityInput): ActivityInput {
  const title = input.title.trim();
  if (!title) throw new Error("Digite um título para a atividade.");
  if (title.length > 120) throw new Error("O título pode ter até 120 caracteres.");
  if (input.description.length > 2000) {
    throw new Error("A descrição pode ter até 2.000 caracteres.");
  }

  return {
    title,
    description: input.description.trim(),
    category: input.category,
    status: input.status,
    imageUrl: validateOptionalUrl(input.imageUrl, "URL da imagem"),
    linkUrl: validateOptionalUrl(input.linkUrl, "link externo"),
  };
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function addActivity(input: ActivityInput): Activity {
  const activities = readActivities();
  const now = new Date().toISOString();
  const activity = validateActivity({
    id: createId(),
    ...normalizeInput(input),
    createdAt: now,
    updatedAt: now,
  });
  saveActivities([...activities, activity]);
  return activity;
}

export function updateActivity(id: string, changes: Partial<ActivityInput>): Activity {
  const activities = readActivities();
  const existing = activities.find((activity) => activity.id === id);
  if (!existing) throw new Error("Esta atividade não foi encontrada.");

  const updated = validateActivity({
    ...existing,
    ...normalizeInput({ ...existing, ...changes }),
    updatedAt: new Date().toISOString(),
  });
  saveActivities(activities.map((activity) => (activity.id === id ? updated : activity)));
  return updated;
}

export function deleteActivity(id: string): void {
  const activities = readActivities();
  saveActivities(activities.filter((activity) => activity.id !== id));
}

export function makeBackup(activities: Activity[]): ActivityBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activities: validateActivityRecords(activities),
  };
}
