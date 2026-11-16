import { Scale, Search, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  GENERAL_RULES_WARNING,
  RULE_CATEGORIES,
  SERVER_RULES,
  filterServerRules,
  type RuleCategoryFilter,
} from "@/data/server-rules";
import { cn } from "@/lib/utils";

export function ServerRulesBook() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<RuleCategoryFilter>("All");

  const categoryCounts = useMemo(() => {
    const counts: Record<RuleCategoryFilter, number> = {
      All: SERVER_RULES.length,
      Roleplay: 0,
      Gameplay: 0,
      Economy: 0,
      Communication: 0,
      "Staff Conduct": 0,
    };
    for (const rule of SERVER_RULES) {
      counts[rule.category] += 1;
    }
    return counts;
  }, []);

  const filteredRules = useMemo(
    () => filterServerRules(SERVER_RULES, searchQuery, selectedCategory),
    [searchQuery, selectedCategory],
  );

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedCategory !== "All";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Mandatory General Compliance Warning */}
      <div
        role="note"
        aria-label="General server rules notice"
        className="rounded-2xl border border-purple-500/45 bg-gradient-to-r from-[#140826]/95 via-[#1c0b33]/90 to-[#140826]/95 p-5 shadow-[0_0_32px_-12px_rgba(168,85,247,0.45)] md:p-6"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/40 bg-orange-950/50 text-orange-400">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
              Official Player Compliance Notice
            </p>
            <p className="mt-1.5 text-base font-medium leading-relaxed text-white md:text-lg">
              {GENERAL_RULES_WARNING}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="rounded-2xl border border-purple-500/35 bg-[#090414]/90 p-4 backdrop-blur-md md:p-5">
        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/75"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules by number (01–30), title, or keyword..."
              aria-label="Search server rules"
              className="h-12 w-full rounded-xl border border-purple-500/35 bg-[#05020b] pl-10 pr-11 text-sm text-white placeholder:text-purple-200/45 transition-colors focus:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 md:text-base"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-purple-200/70 transition-colors hover:bg-purple-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Category Filter Buttons */}
          <div
            role="group"
            aria-label="Filter rules by category"
            className="flex flex-wrap items-center gap-2"
          >
            {(["All", ...RULE_CATEGORIES] as const).map((category) => {
              const isActive = selectedCategory === category;
              const label = category === "All" ? "All Rules" : category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold tracking-wide transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 md:text-sm",
                    isActive
                      ? "border-purple-400 bg-purple-600/25 text-white shadow-[0_0_20px_-6px_rgba(168,85,247,0.75)]"
                      : "border-purple-500/25 bg-[#100822]/80 text-purple-200/80 hover:border-purple-400/60 hover:bg-purple-900/30 hover:text-white",
                  )}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      "tabular-nums text-xs",
                      isActive ? "text-purple-200" : "text-purple-300/60",
                    )}
                  >
                    {categoryCounts[category]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Results Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-purple-500/20 pt-3 text-xs text-purple-200/75 md:text-sm">
            <p className="tabular-nums">
              Showing <span className="font-semibold text-white">{filteredRules.length}</span> of{" "}
              <span className="font-semibold text-white">{SERVER_RULES.length}</span> official rules
              {selectedCategory !== "All" ? ` · ${selectedCategory}` : ""}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="font-semibold text-purple-300 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      {filteredRules.length > 0 ? (
        <ol
          aria-label="Official Free City Server Rules"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5"
        >
          {filteredRules.map((rule) => (
            <li key={rule.number} className="flex">
              <article
                id={`rule-${rule.number}`}
                className="flex w-full flex-col rounded-2xl border border-purple-500/35 bg-gradient-to-b from-[#110822]/95 to-[#07030f]/95 p-5 shadow-[0_8px_30px_-16px_rgba(147,51,234,0.35)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-purple-400/80 hover:shadow-[0_0_28px_-6px_rgba(168,85,247,0.5)] md:p-6"
              >
                {/* Card Header: Number + Clean Unboxed Category Metadata */}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-4xl font-black leading-none tracking-tight text-purple-300 tabular-nums drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]">
                    {rule.number}
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-purple-300/75">
                    {rule.category}
                  </span>
                </div>

                {/* Exact Rule Title */}
                <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide text-white md:text-[1.65rem]">
                  {rule.number}. {rule.title}
                </h2>

                {/* Exact Rule Explanation */}
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-200 md:text-base">
                  {rule.description}
                </p>

                {/* Red/Orange Punishment Label */}
                <div className="mt-auto pt-5">
                  <div className="flex items-start gap-2.5 rounded-xl border border-orange-500/40 bg-gradient-to-r from-red-950/75 via-orange-950/60 to-red-950/65 px-3.5 py-2.5">
                    <Scale
                      className="mt-0.5 h-4 w-4 shrink-0 text-orange-400"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-snug text-orange-100">
                      <span className="mr-1.5 font-bold uppercase tracking-wider text-red-400">
                        Punishment:
                      </span>
                      <span className="font-medium text-orange-100">{rule.punishment}</span>
                    </p>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-2xl border border-purple-500/35 bg-[#0b0518]/90 px-6 py-12 text-center">
          <p className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
            No matching rules found
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-purple-200/75">
            Try searching another rule number, title, or keyword, or switch back to all categories.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-purple-400/70 bg-purple-600/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-600/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Show all 30 rules
          </button>
        </div>
      )}
    </div>
  );
}
