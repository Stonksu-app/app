#!/usr/bin/env node
/**
 * Runs every check script in scripts/check-*.ts.
 *
 * They are bundled through esbuild rather than run with Node's TypeScript
 * stripping because the app imports without file extensions, which Node's
 * resolver rejects. `import.meta.env` is shimmed because anything that reaches
 * src/lib/supabase.ts expects Vite to have defined it.
 *
 * Usage: npm run check            all of them
 *        npm run check -- cloud   just scripts/check-cloud.ts
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const filter = process.argv[2];
const scripts = readdirSync('scripts')
  .filter((f) => f.startsWith('check-') && f.endsWith('.ts'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (!scripts.length) {
  console.error(filter ? `No check script matches "${filter}".` : 'No check scripts found.');
  process.exit(1);
}

const out = '.check-run.mjs';
const failed = [];

for (const script of scripts) {
  const name = script.replace(/^check-|\.ts$/g, '');
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
  try {
    execFileSync(
      'npx',
      [
        'esbuild',
        join('scripts', script),
        '--bundle',
        '--platform=node',
        '--format=esm',
        `--outfile=${out}`,
        '--log-level=warning',
        '--define:import.meta.env={}',
      ],
      { stdio: 'inherit', shell: true }
    );
    execFileSync('node', [out], { stdio: 'inherit' });
  } catch {
    failed.push(name);
  } finally {
    rmSync(out, { force: true });
  }
}

console.log('');
if (failed.length) {
  console.error(`${failed.length} check script(s) failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`All ${scripts.length} check scripts passed.`);
