import type { DataProvider } from './providerTypes.js';
import { manualProvider } from './manualProvider.js';
import { icalProvider } from './icalProvider.js';

const PROVIDERS: Record<string, DataProvider> = {
  manual: manualProvider,
  ical: icalProvider,
};

// Select the active provider from CAL_PROVIDER, defaulting to manual.
export function selectProvider(name = process.env.CAL_PROVIDER ?? 'manual'): DataProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown CAL_PROVIDER "${name}". Known: ${Object.keys(PROVIDERS).join(', ')}.`);
  }
  return provider;
}
