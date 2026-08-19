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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toRow, fromRow, hasProgress, classifyWriteError, type CloudState, type ProfileRow } from '../src/lib/cloud';
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
const LOCAL_ONLY = new Set(['testMode', 'reminderEnabled', 'reminderHour']);

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

// --------------------------------- the migrations have a column for each one
// Read in order and concatenated, so a later migration that alters or drops
// something the earlier one created is reflected rather than ignored.
const migrationDir = 'supabase/migrations';
const migrations = readdirSync(migrationDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const sql = migrations.map((f) => readFileSync(join(migrationDir, f), 'utf8')).join('\n');

check('migrations are numbered so they apply in order', migrations.every((f) => /^\d{4}_/.test(f)), migrations.join(', '));

for (const column of Object.keys(row)) {
  if (column === 'id') continue;
  check(
    `the profiles table declares "${column}"`,
    new RegExp(`\\n\\s+${column}\\s`).test(sql),
    `missing from ${migrationDir}`
  );
}

check('row level security is enabled on profiles', /alter table public\.profiles enable row level security/.test(sql));
check('row level security is enabled on attempts', /alter table public\.attempts enable row level security/.test(sql));
check(
  'attempts are unique per completion, so re-syncing cannot duplicate history',
  /unique \(user_id, lesson_id, completed_at\)/.test(sql)
);

// A profile has to exist the moment an account does, or the client hits a
// logged-in-but-no-row state. 0002 replaces 0001's insert-only trigger with one
// that also tracks registration, so exactly one of them must survive.
const createsProfileTrigger = /on_auth_user_status_changed\n\s+after insert or update/.test(sql);
const legacyTriggerDropped = /drop trigger if exists on_auth_user_created on auth\.users;\n\n--/.test(sql);
check('a profile row is created automatically for new accounts', createsProfileTrigger);
check('the superseded trigger from 0001 is dropped, not left duplicating work', legacyTriggerDropped);

check('the account summary view cannot leak other players', /security_invoker = true/.test(sql));
check('the migrations never mention the service_role key', !/service_role/.test(sql));

// ------------------------------------------ how a failed write is classified
// Both of these fail identically on every later attempt too, so getting the
// mapping wrong means progress stops syncing with nothing on screen saying so.
check('a unique violation is read as a taken nickname', classifyWriteError('23505') === 'name-taken');
check('a foreign key violation is read as a deleted account', classifyWriteError('23503') === 'no-account');
check('anything else is just a failure', classifyWriteError('42501') === 'failed');
check('a missing code is a failure, not a guess', classifyWriteError(undefined) === 'failed');

// -------------------------------------------- which side wins on first sync
check('a fresh cloud profile does not count as progress', !hasProgress({ onboarded: false, xp: 0, attempts: [] }));
check('an onboarded profile counts', hasProgress({ onboarded: true, xp: 0, attempts: [] }));
check('xp alone counts', hasProgress({ onboarded: false, xp: 10, attempts: [] }));
check('a lesson history alone counts', hasProgress({ onboarded: false, xp: 0, attempts: sample.attempts }));

console.log(failures === 0 ? '\nAll cloud checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
