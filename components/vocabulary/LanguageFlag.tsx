import { getLanguage, type LanguageId } from "@/lib/languages";

/** Flag-only language marker. The name is exposed as the accessible label and a hover tooltip. */
export function LanguageFlag({ language, className = "" }: { language: LanguageId; className?: string }) {
  const { flag, label } = getLanguage(language);
  return (
    <span role="img" aria-label={label} title={label} className={`leading-none ${className}`}>
      {flag}
    </span>
  );
}
