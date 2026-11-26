"use client";

import { Search, X } from "lucide-react";
import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AnimatedDropdown } from "@/components/ui/animated-dropdown";

type SearchWithCategoryProps = {
  allCategoryLabel: string;
  allCategoryValue: string;
  categories: readonly { label: string; value: string }[];
  category: string;
  onCategoryChange: (category: string) => void;
  onClear: () => void;
  onSearchChange: (search: string) => void;
  onSubmit: () => void;
  search: string;
};

export function SearchWithCategory({
  allCategoryLabel,
  allCategoryValue,
  categories,
  category,
  onCategoryChange,
  onClear,
  onSearchChange,
  onSubmit,
  search,
}: SearchWithCategoryProps) {
  const categoryId = useId();
  const searchId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      aria-label="Pesquisar atividades"
      className="search-with-category"
      onSubmit={submit}
      role="search"
    >
      <div className="search-with-category__category-wrap">
        <label className="sr-only" htmlFor={categoryId}>Filtrar por categoria</label>
        <AnimatedDropdown<string>
          ariaLabel="Filtrar por categoria"
          className="search-with-category__category"
          id={categoryId}
          onChange={onCategoryChange}
          options={[
            { value: allCategoryValue, label: allCategoryLabel },
            ...categories,
          ]}
          value={category}
        />
      </div>

      <div className="search-with-category__query">
        <label className="sr-only" htmlFor={searchId}>Buscar por título</label>
        <input
          autoComplete="off"
          className="search-with-category__input"
          id={searchId}
          onChange={(event) => {
            onSearchChange(event.target.value);
            if (!event.target.value) onClear();
          }}
          placeholder="Buscar"
          type="text"
          value={search}
        />
        {search && (
          <button
            aria-label="Limpar pesquisa"
            className="clear-search"
            onClick={onClear}
            type="button"
          >
            <X aria-hidden="true" size={14} />
          </button>
        )}
      </div>

      <Button
        aria-label="Pesquisar atividades"
        className="search-with-category__submit"
        size="icon"
        type="submit"
        variant="secondary"
      >
        <Search aria-hidden="true" size={17} />
      </Button>
    </form>
  );
}
