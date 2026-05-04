/**
 * Company logo helpers — best-effort lookup via Clearbit's free Logo API.
 * Falls back to the company's first letter on failure.
 */

export function clearbitLogoUrl(company: string): string | null {
  if (!company) return null;
  // crude domain guess: lowercase, drop non-alnum, append .com
  const slug = company
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')   // drop parenthetical asides
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30);
  if (!slug) return null;
  return `https://logo.clearbit.com/${slug}.com`;
}

const COUNTRY_FLAG: Record<string, string> = {
  switzerland: '🇨🇭', swiss: '🇨🇭', zurich: '🇨🇭', geneva: '🇨🇭', basel: '🇨🇭', lausanne: '🇨🇭', bern: '🇨🇭',
  portugal: '🇵🇹', lisbon: '🇵🇹', porto: '🇵🇹',
  germany: '🇩🇪', berlin: '🇩🇪', munich: '🇩🇪', hamburg: '🇩🇪',
  france: '🇫🇷', paris: '🇫🇷',
  spain: '🇪🇸', madrid: '🇪🇸', barcelona: '🇪🇸',
  netherlands: '🇳🇱', amsterdam: '🇳🇱',
  italy: '🇮🇹', milan: '🇮🇹', rome: '🇮🇹',
  united_kingdom: '🇬🇧', uk: '🇬🇧', london: '🇬🇧', england: '🇬🇧', manchester: '🇬🇧',
  ireland: '🇮🇪', dublin: '🇮🇪',
  czechia: '🇨🇿', czech: '🇨🇿', prague: '🇨🇿',
  hungary: '🇭🇺', budapest: '🇭🇺',
  poland: '🇵🇱', warsaw: '🇵🇱',
  united_states: '🇺🇸', usa: '🇺🇸', us: '🇺🇸', america: '🇺🇸', new_york: '🇺🇸',
  canada: '🇨🇦', toronto: '🇨🇦', vancouver: '🇨🇦',
  brazil: '🇧🇷',
  india: '🇮🇳', bangalore: '🇮🇳',
  remote: '🌍', europe: '🇪🇺', eu: '🇪🇺',
  turkey: '🇹🇷', istanbul: '🇹🇷',
};

export function locationFlag(location: string | null | undefined): string {
  if (!location) return '';
  const tokens = location.toLowerCase().split(/[\s,/-]+/);
  for (const t of tokens) {
    const flag = COUNTRY_FLAG[t] ?? COUNTRY_FLAG[t.replace(/_/g, ' ')];
    if (flag) return flag;
  }
  // last word (often country) match
  const last = tokens[tokens.length - 1];
  if (last && COUNTRY_FLAG[last]) return COUNTRY_FLAG[last];
  return '';
}
