// Validate the manual JSON data files without starting the server.
// Usage: npm run validate:data
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MANUAL_DIR } from '../src/server/paths.js';
import {
  validateMatches,
  validateStandings,
  validateBracket,
  validateConfig,
} from '../src/server/providers/validate.js';

async function loadJson(file: string): Promise<unknown> {
  const text = await readFile(path.join(MANUAL_DIR, file), 'utf8');
  return JSON.parse(text);
}

async function main() {
  const checks: Array<[string, (v: unknown) => unknown]> = [
    ['matches.json', validateMatches],
    ['standings.json', validateStandings],
    ['bracket.json', validateBracket],
    ['config.json', validateConfig],
  ];

  let failures = 0;
  for (const [file, validate] of checks) {
    try {
      const data = validate(await loadJson(file));
      const count = Array.isArray(data) ? `${data.length} entries` : 'ok';
      console.log(`✓ ${file} — ${count}`);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${file} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} file(s) failed validation.`);
    process.exit(1);
  }
  console.log('\nAll manual data files are valid.');
}

main();
