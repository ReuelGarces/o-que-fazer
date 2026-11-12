"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Circle,
  Clock3,
  Compass,
  Film,
  GraduationCap,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  ACTIVITY_STATUSES,
  type Activity,
  type ActivityCategory,
  type ActivityStatus,
} from "@/lib/activities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ExpandingCardsProps = {
  activities: Activity[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity, trigger: HTMLButtonElement) => void;
  onStatusChange: (id: string, status: ActivityStatus) => void;
};

const categoryIcons: Record<ActivityCategory, typeof BookOpen> = {
  Livros: BookOpen,
  "Filmes e séries": Film,
  Cursos: GraduationCap,
  Projetos: BriefcaseBusiness,
  Lugares: MapPin,
  Outros: Compass,
};

const categoryStyles: Record<ActivityCategory, string> = {
  Livros: "category-mark--books",
  "Filmes e séries": "category-mark--films",
  Cursos: "category-mark--courses",
  Projetos: "category-mark--projects",
  Lugares: "category-mark--places",
  Outros: "category-mark--other",
};

function statusPresentation(status: ActivityStatus) {
  if (status === "Concluído") {
    return { className: "status-done", icon: Check };
  }
  if (status === "Em andamento") {
    return { className: "status-in-progress", icon: Clock3 };
  }
  return { className: "status-planned", icon: Circle };
}

export function ExpandingCards({
  activities,
  expandedId,
  onExpand,
  onEdit,
  onDelete,
  onStatusChange,
}: ExpandingCardsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <div className="expanding-cards" aria-label="Atividades cadastradas">
      {activities.map((activity) => {
        const isExpanded =
          expandedId === activity.id || hoveredId === activity.id || focusedId === activity.id;
        const Icon = categoryIcons[activity.category];
        const status = statusPresentation(activity.status);
        const StatusIcon = status.icon;
        const cardStyle = {
          "--card-flex": isExpanded ? 2.8 : 1,
        } as CSSProperties;
        const photoStyle = activity.imageUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(41, 38, 33, .08) 0%, rgba(41, 38, 33, .72) 100%), url(${JSON.stringify(activity.imageUrl)})`,
            }
          : undefined;

        return (
          <article
            className={cn("expanding-card", isExpanded && "is-expanded")}
            key={activity.id}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                setFocusedId((current) => current === activity.id ? null : current);
              }
            }}
            onFocusCapture={(event) => {
              if ((event.target as HTMLElement).matches(":focus-visible")) {
                setFocusedId(activity.id);
              }
            }}
            onMouseEnter={() => {
              if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                setHoveredId(activity.id);
              }
            }}
            onMouseLeave={() => {
              setHoveredId((current) => current === activity.id ? null : current);
            }}
            style={cardStyle}
          >
            <button
              aria-controls={`activity-details-${activity.id}`}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${activity.title}, ${activity.category}, status: ${activity.status}`}
            className={cn("expanding-card__cover", isExpanded && "is-expanded", activity.imageUrl && "has-image")}
              onClick={() => onExpand(activity.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  onExpand(activity.id);
                }
                if (event.key === "ArrowUp" && isExpanded) {
                  event.preventDefault();
                  onExpand(activity.id);
                }
              }}
              style={photoStyle}
              type="button"
            >
              {!activity.imageUrl && (
                <span aria-hidden="true" className="expanding-card__symbol">
                  <Icon size={isExpanded ? 56 : 44} strokeWidth={1.5} />
                </span>
              )}
              <span className="expanding-card__topline">
                <span className={cn("category-mark", categoryStyles[activity.category])}>
                  <Icon aria-hidden="true" size={15} strokeWidth={1.5} />
                  {activity.category}
                </span>
                <span className={cn("status-mark", status.className)}>
                  <StatusIcon aria-hidden="true" size={14} strokeWidth={1.6} />
                  {activity.status}
                </span>
              </span>

              <span className="expanding-card__bottomline">
                <span className="expanding-card__title">{activity.title}</span>
                {isExpanded && (
                  <span className="expanding-card__description">
                    {activity.description || "Sem descrição por enquanto."}
                  </span>
                )}
                {!isExpanded && (
                  <span className="expanding-card__tap-hint">
                    <span>Ver detalhes</span>
                    <ArrowDownRight aria-hidden="true" size={15} />
                  </span>
                )}
              </span>
            </button>

            <div
              className="expanding-card__toolbar"
              hidden={!isExpanded}
              id={`activity-details-${activity.id}`}
            >
                <label className="status-select-wrap">
                  <span className="sr-only">Status de {activity.title}</span>
                  <select
                    aria-label={`Alterar status de ${activity.title}`}
                    className="status-select"
                    onChange={(event) =>
                      onStatusChange(activity.id, event.target.value as ActivityStatus)
                    }
                    value={activity.status}
                  >
                    {ACTIVITY_STATUSES.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                  <MoreHorizontal aria-hidden="true" size={15} />
                </label>
                {activity.linkUrl && (
                  <a
                    aria-label={`Abrir link de ${activity.title} em uma nova aba`}
                    className="card-action-link"
                    href={activity.linkUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ArrowUpRight aria-hidden="true" size={15} />
                    Link
                  </a>
                )}
                <div className="expanding-card__actions">
                  <Button
                    aria-label={`Editar ${activity.title}`}
                    className="card-icon-button"
                    onClick={() => onEdit(activity)}
                    size="icon"
                    title="Editar atividade"
                    variant="ghost"
                  >
                    <Pencil aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    aria-label={`Excluir ${activity.title}`}
                    className="card-icon-button card-icon-button--danger"
                    onClick={(event) => onDelete(activity, event.currentTarget)}
                    size="icon"
                    title="Excluir atividade"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </Button>
                </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
