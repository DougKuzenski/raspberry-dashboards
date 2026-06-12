import type { TeamRef } from '../../shared/types.js';

// OpenFootball gives full nation names only (no codes/flags). Map the names we
// expect at WC2026 to a FIFA-style code + ISO2 (for the flag emoji). Unknown
// names fall back to a derived 3-letter id and no flag, so the adapter never
// throws on an unfamiliar team.

interface Nation {
  code: string; // FIFA-style 3-letter display code
  iso2: string; // for flag emoji generation ('' = use a literal flag override)
  flag?: string; // explicit override for subdivision flags (Wales/England/Scotland)
}

const NATIONS: Record<string, Nation> = {
  mexico: { code: 'MEX', iso2: 'MX' },
  'united states': { code: 'USA', iso2: 'US' },
  usa: { code: 'USA', iso2: 'US' },
  canada: { code: 'CAN', iso2: 'CA' },
  'south africa': { code: 'RSA', iso2: 'ZA' },
  'south korea': { code: 'KOR', iso2: 'KR' },
  'korea republic': { code: 'KOR', iso2: 'KR' },
  germany: { code: 'GER', iso2: 'DE' },
  'czech republic': { code: 'CZE', iso2: 'CZ' },
  czechia: { code: 'CZE', iso2: 'CZ' },
  croatia: { code: 'CRO', iso2: 'HR' },
  wales: { code: 'WAL', iso2: '', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  england: { code: 'ENG', iso2: '', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  scotland: { code: 'SCO', iso2: '', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  france: { code: 'FRA', iso2: 'FR' },
  senegal: { code: 'SEN', iso2: 'SN' },
  brazil: { code: 'BRA', iso2: 'BR' },
  japan: { code: 'JPN', iso2: 'JP' },
  argentina: { code: 'ARG', iso2: 'AR' },
  spain: { code: 'ESP', iso2: 'ES' },
  netherlands: { code: 'NED', iso2: 'NL' },
  portugal: { code: 'POR', iso2: 'PT' },
  belgium: { code: 'BEL', iso2: 'BE' },
  italy: { code: 'ITA', iso2: 'IT' },
  uruguay: { code: 'URU', iso2: 'UY' },
  colombia: { code: 'COL', iso2: 'CO' },
  ecuador: { code: 'ECU', iso2: 'EC' },
  morocco: { code: 'MAR', iso2: 'MA' },
  nigeria: { code: 'NGA', iso2: 'NG' },
  ghana: { code: 'GHA', iso2: 'GH' },
  egypt: { code: 'EGY', iso2: 'EG' },
  cameroon: { code: 'CMR', iso2: 'CM' },
  'ivory coast': { code: 'CIV', iso2: 'CI' },
  "côte d'ivoire": { code: 'CIV', iso2: 'CI' },
  australia: { code: 'AUS', iso2: 'AU' },
  'saudi arabia': { code: 'KSA', iso2: 'SA' },
  iran: { code: 'IRN', iso2: 'IR' },
  'ir iran': { code: 'IRN', iso2: 'IR' },
  qatar: { code: 'QAT', iso2: 'QA' },
  switzerland: { code: 'SUI', iso2: 'CH' },
  denmark: { code: 'DEN', iso2: 'DK' },
  poland: { code: 'POL', iso2: 'PL' },
  serbia: { code: 'SRB', iso2: 'RS' },
  austria: { code: 'AUT', iso2: 'AT' },
  norway: { code: 'NOR', iso2: 'NO' },
  sweden: { code: 'SWE', iso2: 'SE' },
  turkey: { code: 'TUR', iso2: 'TR' },
  türkiye: { code: 'TUR', iso2: 'TR' },
  'costa rica': { code: 'CRC', iso2: 'CR' },
  panama: { code: 'PAN', iso2: 'PA' },
  jamaica: { code: 'JAM', iso2: 'JM' },
  peru: { code: 'PER', iso2: 'PE' },
  chile: { code: 'CHI', iso2: 'CL' },
  paraguay: { code: 'PAR', iso2: 'PY' },
  'new zealand': { code: 'NZL', iso2: 'NZ' },
  tunisia: { code: 'TUN', iso2: 'TN' },
  algeria: { code: 'ALG', iso2: 'DZ' },
  mali: { code: 'MLI', iso2: 'ML' },
  honduras: { code: 'HON', iso2: 'HN' },
  uzbekistan: { code: 'UZB', iso2: 'UZ' },
  jordan: { code: 'JOR', iso2: 'JO' },
  'cape verde': { code: 'CPV', iso2: 'CV' },
  'cape verde islands': { code: 'CPV', iso2: 'CV' },
  curaçao: { code: 'CUW', iso2: 'CW' },
  'bosnia-herzegovina': { code: 'BIH', iso2: 'BA' },
  'bosnia and herzegovina': { code: 'BIH', iso2: 'BA' },
  haiti: { code: 'HAI', iso2: 'HT' },
  iraq: { code: 'IRQ', iso2: 'IQ' },
  'congo dr': { code: 'COD', iso2: 'CD' },
  'dr congo': { code: 'COD', iso2: 'CD' },
};

// Regional-indicator flag emoji from an ISO2 country code.
function flagFromIso2(iso2: string): string | undefined {
  if (iso2.length !== 2) return undefined;
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + iso2.toUpperCase().charCodeAt(0) - 65,
    A + iso2.toUpperCase().charCodeAt(1) - 65,
  );
}

function deriveId(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, 3) || 'UNK';
}

/** Resolve a full nation name to a TeamRef with code + flag. */
export function resolveTeam(name: string): TeamRef {
  const key = name.trim().toLowerCase();
  const nation = NATIONS[key];
  if (nation) {
    return {
      id: nation.code,
      name,
      shortName: nation.code,
      flagEmoji: nation.flag ?? flagFromIso2(nation.iso2),
    };
  }
  // Unknown team (or a knockout placeholder string handled elsewhere).
  return { id: deriveId(name), name, shortName: deriveId(name) };
}
