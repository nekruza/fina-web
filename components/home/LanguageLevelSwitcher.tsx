"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LANGUAGES, getLanguage, type LanguageId } from "@/lib/languages";
import { USER_LEVELS, levelLabel, type UserLevel } from "@/lib/levels";

export interface LanguageLevelSwitcherProps {
  language: LanguageId;
  level: UserLevel;
  onLanguageChange: (id: LanguageId) => void;
  onLevelChange: (level: UserLevel) => void;
}

/**
 * Home-header flag + level buttons. Ported from fina `app/(tabs)/index.tsx`:
 * a flag button opens the language list, a level button opens the level
 * list. Uses a popover instead of the mobile bottom-sheet modals.
 */
export function LanguageLevelSwitcher({ language, level, onLanguageChange, onLevelChange }: LanguageLevelSwitcherProps) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const currentLanguage = getLanguage(language);
  const currentLevelLabel = levelLabel(level);

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-[0_8px_20px_-18px_rgba(27,26,23,0.35)]">
      <span className="hidden px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sub sm:block">Learning</span>
      <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Current language: ${currentLanguage.label}. Change language.`}
            className="flex items-center gap-0.5 rounded-xl p-2 text-2xl transition-[background-color] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            <span aria-hidden>{currentLanguage.flag}</span>
            <ChevronDown className="h-4 w-4 text-sub" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 rounded-2xl border-line bg-surface p-2">
          <div role="menu" aria-label="Choose language" className="flex flex-col gap-0.5">
            {LANGUAGES.map((l) => (
              <div key={l.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={l.id === language}
                  onClick={() => {
                    onLanguageChange(l.id);
                    setLanguageOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                    l.id === language ? "bg-accent-soft font-semibold text-ink" : "text-ink hover:bg-cream"
                  }`}
                >
                  <span aria-hidden className="text-lg">
                    {l.flag}
                  </span>
                  {l.label}
                </button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={levelOpen} onOpenChange={setLevelOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Current level: ${currentLevelLabel}. Change level.`}
            className="flex items-center gap-1 rounded-xl px-2 py-2 transition-[background-color] hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            <span className="text-lg font-semibold text-ink">{currentLevelLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-ink" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 rounded-2xl border-line bg-surface p-2">
          <div role="menu" aria-label="Choose level" className="flex flex-col gap-0.5">
            {USER_LEVELS.map((lvl) => (
              <div key={lvl.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={lvl.id === level}
                  onClick={() => {
                    onLevelChange(lvl.id);
                    setLevelOpen(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                    lvl.id === level ? "bg-accent-soft font-semibold text-ink" : "text-ink hover:bg-cream"
                  }`}
                >
                  {lvl.label}
                </button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
