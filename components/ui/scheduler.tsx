"use client";

import { cn } from "@/lib/utils";
import type { RecurrenceFrequency } from "@/lib/activities";

interface ComponentProps {
  isRepeating: boolean;
  toggleRepeating: () => void;
  repeatInterval: Exclude<RecurrenceFrequency, "none">;
  setRepeatInterval: (interval: Exclude<RecurrenceFrequency, "none">) => void;
  recurrenceInterval: number;
  setRecurrenceInterval: (interval: number) => void;
}

const frequencyLabels: Record<Exclude<RecurrenceFrequency, "none">, string> = {
  daily: "Todos os dias",
  weekly: "Toda semana",
  monthly: "Todo mês",
  custom: "Personalizado: a cada N dias",
};

export function Component({
  isRepeating,
  toggleRepeating,
  repeatInterval,
  setRepeatInterval,
  recurrenceInterval,
  setRecurrenceInterval,
}: ComponentProps) {
  return (
    <section aria-labelledby="activity-repeat-title" className="scheduler form-field--wide">
      <div className="scheduler__header">
        <div>
          <h3 id="activity-repeat-title">Repetição</h3>
          <p>Ative para guardar uma frequência para esta atividade.</p>
        </div>
        <button
          aria-checked={isRepeating}
          aria-label="Repetir atividade"
          className="scheduler__switch"
          onClick={toggleRepeating}
          role="switch"
          type="button"
        >
          <span aria-hidden="true" className="scheduler__switch-thumb" />
        </button>
      </div>

      <div className={cn("scheduler__controls", !isRepeating && "is-disabled")}>
        <label className="scheduler__frequency" htmlFor="activity-repeat-interval">
          <span>Frequência</span>
          <select
            disabled={!isRepeating}
            id="activity-repeat-interval"
            onChange={(event) => setRepeatInterval(event.target.value as Exclude<RecurrenceFrequency, "none">)}
            value={repeatInterval}
          >
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {isRepeating && repeatInterval === "custom" && (
          <label className="scheduler__frequency" htmlFor="activity-recurrence-interval">
            <span>Intervalo em dias</span>
            <input
              id="activity-recurrence-interval"
              max={3650}
              min={1}
              onChange={(event) => setRecurrenceInterval(Number(event.target.value))}
              required
              type="number"
              value={recurrenceInterval}
            />
            <span className="field-hint">Escolha entre 1 e 3.650 dias.</span>
          </label>
        )}
      </div>
    </section>
  );
}
