/**
 * Guards the Supabase sync against silent data loss.
 *
 * The failure this exists to catch: someone adds a field to the store, forgets
 * the mapping or the SQL column, and that field quietly stops syncing. Nothing
 * throws, nothing looks wrong, and a player finds out when they reinstall and
 * their coins are gone. So the three layers are cross-checked against each
 * other: store state, the TypeScript mapping, and the migration itself.
 *
 * Run: npx esbuild scripts/check-cloud.ts --bundle --platform=node --format=esm
 *        --outfile=.check.mjs && node .check.mjs && rm .check.mjs
 */
import { readFileSync } from 'node:fs';
import { toRow, fromRow, hasProgress, type CloudState, type ProfileRow } from '../src/lib/cloud';
import { useUserStore } from '../src/store/useUserStore';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Every field filled with a value distinct from its default, so a mapping that
 *  drops one shows up as a difference rather than as a coincidental match. */
const sample: CloudState = {
  name: 'Chris',
  onboarded: true,
  onboardingAnswers: { experience: 'novato', goal: 'aprender' },
  xp: 1234,
  coins: 567,
  hearts: 3,
  lastHeartLostAt: '2026-08-19T10:00:00.000Z',
  streak: 12,
  lastActiveDate: '2026-08-19',
  streakProtectors: 2,
  completedLessonIds: ['fundamentos-1', 'velas-1'],
  unlockedBadgeIds: ['perfect-lesson'],
  seenIntroNodeIds: ['fundamentos'],
  openedChestIds: ['chest-fundamentos'],
  claimedMissionIds: ['rey-del-mercado'],
  unlockedAccessories: ['ninguno', 'corona'],
  pendingMistakes: ['fundamentos::f2'],
  nodeStageProgress: { fundamentos: 5, indicadores: 2 },
  avatar: {
    body: '#FF5252',
    mask: '#2a0e0e',
    horns: 'largos',
    eyes: 'estrellas',
    accessory: 'corona',
    accessoryColor: '#47BFFF',
  },
  virtualBalance: 12345.67,
  attempts: [
    {
      lessonId: 'fundamentos-1',
      nodeId: 'fundamentos',
      completedAt: '2026-08-18T09:30:00.000Z',
      xpEarned: 70,
      correctCount: 7,
      totalQuestions: 7,
    },
  ],
};

// ------------------------------------------------- the mapping is lossless
const row = toRow(sample, 'user-uuid');
const back = fromRow(row as unknown as ProfileRow, sample.attempts);

for (const key of Object.keys(sample) as (keyof CloudState)[]) {
  check(
    `"${key}" survives the round trip`,
    JSON.stringify(back[key]) === JSON.stringify(sample[key]),
    `sent ${JSON.stringify(sample[key])}, got back ${JSON.stringify(back[key])}`
  );
}

// Postgres returns numeric as a string; the mapping has to convert it back or
// the virtual balance turns into "12345.67" and arithmetic on it concatenates.
const asPostgresReturnsIt = { ...row, virtual_balance: '12345.67' } as unknown as ProfileRow;
const converted = fromRow(asPostgresReturnsIt, []);
check(
  'a numeric column comes back as a number, not a string',
  typeof converted.virtualBalance === 'number' && converted.virtualBalance === 12345.67,
  `got ${typeof converted.virtualBalance} ${converted.virtualBalance}`
);

// ------------------------------------- nothing persisted is left un-synced
const storeState = useUserStore.getState();
const persistedKeys = Object.keys(storeState).filter(
  (k) => typeof (storeState as Record<string, unknown>)[k] !== 'function'
);
const cloudKeys = new Set(Object.keys(sample));
/** Local-only by design: a debugging switch, not progress. */
const LOCAL_ONLY = new Set(['testMode']);

for (const key of persistedKeys) {
  if (LOCAL_ONLY.has(key)) {
    check(`"${key}" is deliberately kept off the cloud`, !cloudKeys.has(key));
    continue;
  }
  check(`store field "${key}" is synced`, cloudKeys.has(key), 'add it to CloudState, toRow and fromRow');
}

for (const key of cloudKeys) {
  check(`"${key}" still exists in the store`, persistedKeys.includes(key), 'CloudState has a field the store dropped');
}

// --------------------------------- the migration has a column for each one
const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
const profilesBlock = sql.slice(sql.indexOf('create table if not exists public.profiles'), sql.indexOf('-- ---------------------------------------------------------------- attempts'));

for (const column of Object.keys(row)) {
  if (column === 'id') continue;
  check(`the profiles table declares "${column}"`, new RegExp(`\\n\\s+${column}\\s`).test(profilesBlock), 'missing from 0001_init.sql');
}

check('row level security is enabled on profiles', /alter table public\.profiles enable row level security/.test(sql));
check('row level security is enabled on attempts', /alter table public\.attempts enable row level security/.test(sql));
check(
  'attempts are unique per completion, so re-syncing cannot duplicate history',
  /unique \(user_id, lesson_id, completed_at\)/.test(sql)
);
check('a profile row is created automatically for new accounts', /on_auth_user_created/.test(sql));
check('the migration never mentions the service_role key', !/service_role/.test(sql));

// -------------------------------------------- which side wins on first sync
check('a fresh cloud profile does not count as progress', !hasProgress({ onboarded: false, xp: 0, attempts: [] }));
check('an onboarded profile counts', hasProgress({ onboarded: true, xp: 0, attempts: [] }));
check('xp alone counts', hasProgress({ onboarded: false, xp: 10, attempts: [] }));
check('a lesson history alone counts', hasProgress({ onboarded: false, xp: 0, attempts: sample.attempts }));

console.log(failures === 0 ? '\nAll cloud checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
