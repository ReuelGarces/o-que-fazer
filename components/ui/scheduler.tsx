"use client";

import { cn } from "@/lib/utils";

interface ComponentProps {
  isRepeating: boolean;
  toggleRepeating: () => void;
  repeatInterval: string;
  setRepeatInterval: (interval: string) => void;
  daysOfWeek: string[];
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
}

const dayLabels: Record<string, string> = {
  Mo: "Seg",
  Tu: "Ter",
  We: "Qua",
  Th: "Qui",
  Fr: "Sex",
  Sa: "Sáb",
  Su: "Dom",
};

export function Component({
  isRepeating,
  toggleRepeating,
  repeatInterval,
  setRepeatInterval,
  daysOfWeek,
  selectedDays,
  setSelectedDays,
}: ComponentProps) {
  function toggleDay(day: string) {
    setSelectedDays(
      selectedDays.includes(day)
        ? selectedDays.filter((selectedDay) => selectedDay !== day)
        : [...selectedDays, day],
    );
  }

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
            onChange={(event) => setRepeatInterval(event.target.value)}
            value={repeatInterval}
          >
            <option value="Daily">Todos os dias</option>
            <option value="Weekly">Toda semana</option>
            <option value="Monthly">Todo mês</option>
          </select>
        </label>

        {isRepeating && repeatInterval === "Weekly" && (
          <fieldset className="scheduler__weekdays">
            <legend>Repetir em</legend>
            <div aria-label="Dias da semana" className="scheduler__day-list" role="group">
              {daysOfWeek.map((day) => {
                const selected = selectedDays.includes(day);
                return (
                  <button
                    aria-pressed={selected}
                    className={cn("scheduler__day", selected && "is-selected")}
                    key={day}
                    onClick={() => toggleDay(day)}
                    type="button"
                  >
                    {dayLabels[day] ?? day}
                  </button>
                );
              })}
            </div>
            <p>Escolha ao menos um dia para a repetição semanal.</p>
          </fieldset>
        )}
      </div>
    </section>
  );
}
