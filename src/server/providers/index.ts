import type { DataProvider } from './providerTypes.js';
import { manualProvider } from './manualProvider.js';
import { worldCupApiProvider } from './worldCupApiProvider.js';
import { openFootballProvider } from './openFootballProvider.js';

const PROVIDERS: Record<string, DataProvider> = {
  manual: manualProvider,
  worldcup_api: worldCupApiProvider,
  openfootball: openFootballProvider,
};

// Select the active provider from DATA_PROVIDER, defaulting to manual (spec §12).
export function selectProvider(name = process.env.DATA_PROVIDER ?? 'manual'): DataProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    const known = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unknown DATA_PROVIDER "${name}". Known providers: ${known}.`);
  }
  return provider;
}
