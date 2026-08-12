import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import { CATEGORIES, CATEGORY_IDS, TOTAL_PLANNED_CHALLENGES } from '@/challenges/categories';
import { challengeRegistry } from '@/challenges/registry';
import { Button } from '@/components/ui/button';
import { progressQueryOptions } from '@/data/queries';
import {
  allTags,
  DIFFICULTIES,
  filterChallenges,
  STATUSES,
  TECHS,
  type CatalogSearch,
} from '@/features/catalog/catalog-search';
import { ChallengeCard } from '@/features/catalog/ChallengeCard';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores';

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none';

export function CatalogPage(): React.JSX.Element {
  const search = useSearch({ from: '/challenges' });
  const navigate = useNavigate();
  const repo = useProgressRepository();
  const { data: progressList = [] } = useQuery(progressQueryOptions(repo));
  const progressById = useMemo(
    () => new Map(progressList.map((record) => [record.challengeId, record])),
    [progressList],
  );
  const { challenges } = challengeRegistry;
  const filtered = useMemo(
    () => filterChallenges(challenges, search, progressById),
    [challenges, search, progressById],
  );
  const tags = useMemo(() => allTags(challenges), [challenges]);
  const viewMode = useWorkspaceStore((state) => state.catalogViewMode);
  const setCatalogViewMode = useWorkspaceStore((state) => state.setCatalogViewMode);
  const hasFilters = Object.values(search).some((value) => value !== undefined);

  const updateSearch = (patch: Partial<CatalogSearch>): void => {
    void navigate({ to: '/challenges', search: (previous) => ({ ...previous, ...patch }), replace: true });
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-muted-foreground text-sm">
          {challenges.length} of {TOTAL_PLANNED_CHALLENGES} authored · {filtered.length} shown.
        </p>
      </header>

      {/*
        The semantic `<search>` landmark (not `<form role="search">`: oxlint's
        jsx-a11y/prefer-tag-over-role wants the dedicated tag) also means there is no `<form>` to
        submit — pressing Enter in the search input is a no-op, which is what we want here since
        every filter already applies on change.
      */}
      <search aria-label="Filter challenges" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <label htmlFor="catalog-q" className="text-sm font-medium">
            Search
          </label>
          <input
            id="catalog-q"
            type="search"
            value={search.q ?? ''}
            onChange={(event) => updateSearch({ q: event.target.value === '' ? undefined : event.target.value })}
            className={cn(SELECT_CLASS, 'w-full')}
            placeholder="Title, id, or tag"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="catalog-category"
            value={search.category ?? ''}
            onChange={(event) => updateSearch({ category: CATEGORY_IDS.find((id) => id === event.target.value) })}
            className={SELECT_CLASS}
          >
            <option value="">All</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-difficulty" className="text-sm font-medium">
            Difficulty
          </label>
          <select
            id="catalog-difficulty"
            value={search.difficulty ?? ''}
            onChange={(event) =>
              updateSearch({ difficulty: DIFFICULTIES.find((value) => value === event.target.value) })
            }
            className={SELECT_CLASS}
          >
            <option value="">All</option>
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-tech" className="text-sm font-medium">
            Tech
          </label>
          <select
            id="catalog-tech"
            value={search.tech ?? ''}
            onChange={(event) => updateSearch({ tech: TECHS.find((value) => value === event.target.value) })}
            className={SELECT_CLASS}
          >
            <option value="">All</option>
            {TECHS.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="catalog-status"
            value={search.status ?? ''}
            onChange={(event) => updateSearch({ status: STATUSES.find((value) => value === event.target.value) })}
            className={SELECT_CLASS}
          >
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-tag" className="text-sm font-medium">
            Tag
          </label>
          <select
            id="catalog-tag"
            value={search.tag ?? ''}
            onChange={(event) => updateSearch({ tag: tags.find((value) => value === event.target.value) })}
            className={SELECT_CLASS}
          >
            <option value="">All</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              updateSearch({
                q: undefined,
                category: undefined,
                difficulty: undefined,
                tech: undefined,
                status: undefined,
                tag: undefined,
              })
            }
          >
            Clear filters
          </Button>
        ) : null}
        {/* jsx-a11y/prefer-tag-over-role wants a semantic tag over role="group"; `fieldset` +
            a visually-hidden `legend` is the same pattern OutputPane's view toggle already uses. */}
        <fieldset className="m-0 ml-auto flex gap-1 border-0 p-0">
          <legend className="sr-only">View mode</legend>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            onClick={() => setCatalogViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            onClick={() => setCatalogViewMode('list')}
          >
            List
          </Button>
        </fieldset>
      </search>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No challenges match these filters.</p>
      ) : (
        <ul className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2')}>
          {filtered.map((challenge) => (
            <li key={challenge.id}>
              <ChallengeCard challenge={challenge} record={progressById.get(challenge.id)} view={viewMode} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
