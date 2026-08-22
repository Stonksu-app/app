/**
 * Guards the two ways .platinum-node has already gone wrong.
 *
 * It draws its shine with an absolutely positioned ::after inset -40%, which
 * means the element wearing it has to establish its own containing block. Miss
 * that and the shine resolves against some ancestor far up the tree: the first
 * time, a progress bar swept a diagonal highlight across the entire screen.
 *
 * The fix for that was to drop `position: relative` from the class itself,
 * because this stylesheet is unlayered and a blanket position outranks
 * Tailwind's `sticky` — which silently unstuck the unit banner. So both
 * mistakes are one rule apart, and both are invisible until someone looks at
 * the right screen with the right progress. Hence a check.
 *
 * Run: npm run check -- styles
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const css = readFileSync('src/index.css', 'utf8');

const rule = css.match(/\.platinum-node \{[^}]*\}/)?.[0] ?? '';
check('.platinum-node exists', rule.length > 0);
check(
  '.platinum-node no impone position (rompería el sticky del banner)',
  !/position:/.test(rule),
  rule.replace(/\s+/g, ' ')
);
check('.platinum-node recorta su brillo', /overflow:\s*hidden/.test(rule));

/*
 * Premium and mastery own one colour, and it isn't sky.
 *
 * Sky already means three things — the streak protector, a frozen day and the
 * section 2 banner — which is why the platinum finish moved off it. Nothing
 * stops it drifting back except this.
 */
check(
  'el acabado platino usa el violeta de ultra, no el azul del protector',
  /#c4b5fd/i.test(rule) && !/#38bdf8|#7dd3fc/i.test(rule),
  rule.replace(/\s+/g, ' ')
);
check(
  'el violeta de ultra está declarado en la paleta',
  /--color-ultra-400:\s*#a78bfa/i.test(css)
);

/** Anything that makes an element a containing block for absolute children. */
const POSITIONS = ['relative', 'absolute', 'fixed', 'sticky'];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}

for (const file of walk('src')) {
  const source = readFileSync(file, 'utf8');
  source.split('\n').forEach((line, i) => {
    if (!line.includes('platinum-node')) return;
    // The class list can be split over lines by the formatter, so look at the
    // line itself plus its neighbours — enough to catch a className that
    // wraps, without reading the whole component as one string.
    const around = source
      .split('\n')
      .slice(Math.max(0, i - 6), i + 3)
      .join(' ');
    // A class list kept in a constant can't know what will wear it — the unit
    // banner's is sticky, which positions it. Those say so out loud rather
    // than being silently exempt.
    if (around.includes('platinum-position-ok')) return;
    check(
      `${file}:${i + 1} coloca el brillo en su sitio`,
      POSITIONS.some((p) => new RegExp(`(^|[\\s'"\`])${p}([\\s'"\`]|$)`).test(around)),
      'añade "relative" junto a platinum-node, o el brillo barrerá toda la pantalla'
    );
  });
}

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
