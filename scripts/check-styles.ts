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
import { LEAGUE_RANKS } from '../src/data/leagues';

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
// From the declaration only. Reading the whole rule picked up the hex codes
// quoted in the comment explaining why they were replaced, and duly failed on
// the colour that had already been removed.
const ramp = rule.match(/background-image:[^;]*;/)?.[0] ?? '';
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
  /#[0-9a-f]{6}/i.test(ramp) && !/#38bdf8|#7dd3fc|#2563eb/i.test(ramp),
  ramp
);
check(
  'el violeta de ultra está declarado en la paleta',
  /--color-ultra-400:\s*#a78bfa/i.test(css)
);

/*
 * White has to be readable on the platinum surface.
 *
 * The first version of this gradient started at #f5f3ff, which is white text
 * on a white background: 1.1:1. It looked like a pale smear with writing you
 * had to guess at. Since the surface always carries white content — the
 * banner's title, a node's icon, the dialog's chip — every stop it passes
 * through has to clear 4.5:1, and only a check can hold that.
 */
function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastWithWhite(hex: string): number {
  const l = luminance(hex);
  return (1.05) / (l + 0.05);
}

const stops = [...ramp.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
check('el degradado platino declara sus paradas', stops.length >= 2, rule.replace(/\s+/g, ' '));
for (const stop of stops) {
  const ratio = contrastWithWhite(stop);
  check(
    `blanco sobre ${stop} se lee (${ratio.toFixed(2)}:1)`,
    ratio >= 4.5,
    'esta parada del degradado deja el texto blanco ilegible'
  );
}

/* The other class paints text *on* the dark path, so the rule inverts: it has
   to stay light enough against carbon-900, and starting at near-white is what
   made the titles read as washed out rather than as violet. */
const textRule = css.match(/\.platinum-text \{[^}]*\}/)?.[0] ?? '';
const textStops = [...textRule.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
const carbon900 = luminance('#171717');
for (const stop of textStops) {
  const ratio = (luminance(stop) + 0.05) / (carbon900 + 0.05);
  check(`${stop} se lee sobre el fondo oscuro (${ratio.toFixed(2)}:1)`, ratio >= 4.5);
  check(`${stop} no es casi blanco`, contrastWithWhite(stop) >= 1.25, 'demasiado cerca del blanco para leerse como violeta');
}

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

/*
 * The league ladder has to read as a ladder.
 *
 * Six ranks drawn from the app's own icon set, in metals of their own — emoji
 * rendered as whatever each platform ships, which on Android is a different
 * drawing style from every other mark on the screen. And the tones stay off
 * the colours that already mean something: violet is Ultra, so a rank wearing
 * it would say "this person pays" rather than "this person climbed", and sky
 * belongs to streak protectors.
 */
for (const rank of LEAGUE_RANKS) {
  check(`la liga "${rank.name}" usa un icono de la app`, typeof rank.icon === 'string' && rank.icon.length > 0);
  check(
    `y un color que no pisa a Ultra ni al protector: ${rank.name}`,
    !/ultra|sky/.test(rank.tone),
    rank.tone
  );
  check(
    `"${rank.name}" ya no es un emoji`,
    !/[\u{1F300}-\u{1FAFF}]/u.test(`${rank.icon}${rank.tone}`)
  );
}
check(
  'solo la última liga brilla',
  LEAGUE_RANKS.filter((r) => r.glow).length === 1 &&
    !!LEAGUE_RANKS[LEAGUE_RANKS.length - 1].glow
);
check(
  'los metales de la liga están declarados en la paleta',
  /--color-league-bronze/.test(css) &&
    /--color-league-silver/.test(css) &&
    /--color-league-gold/.test(css)
);

/*
 * Element defaults have to live in @layer base.
 *
 * This stylesheet is unlayered, so a bare `button { … }` outranks every
 * Tailwind utility — which is how `touch-action: manipulation` quietly beat
 * `touch-none` on the draggable chips in the classify game and let the
 * browser keep the gesture for panning. Same shape of bug as the blanket
 * `position` that once unstuck the unit banner.
 */
const bareElementRule = new RegExp(
  String.raw`(^|
)(button|input|a|p|h[1-6])\s*\{[^}]*\}`
).exec(css);
check(
  'ningún elemento lleva estilos por defecto fuera de @layer base',
  bareElementRule === null,
  bareElementRule ? bareElementRule[0].replace(/\s+/g, ' ').slice(0, 80) : ''
);
check(
  'y los que hay están dentro de la capa',
  new RegExp(String.raw`@layer base \{[\s\S]*button \{`).test(css)
);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
