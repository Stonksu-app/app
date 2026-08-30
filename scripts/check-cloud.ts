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
  termMastery: { 'fc-soporte': 3, 'fc-resistencia': 1 },
  plan: 'ultra',
  planStartedAt: '2026-08-20T08:00:00.000Z',
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
  frozenDates: ['2026-08-15', '2026-08-16'],
  reviewDates: ['2026-08-17'],
  activeDates: ['2026-08-17', '2026-08-18'],
  leagueRewardedRank: 3,
  weeklyXp: 340,
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
/**
 * Local-only by design, each for its own reason.
 *
 * Listing them here is the point of the check: a field left out of the cloud
 * mapping by accident looks exactly like one left out on purpose, so the only
 * difference that can be enforced is whether someone wrote it down.
 *
 * - testMode: a debugging switch, not progress.
 * - reminder*: the notification permission behind them is granted per device.
 * - lastStreakLoss: an explanation of what happened on this device, not
 *   progress. Syncing it would mean explaining a phone's lost streak on a
 *   laptop that never saw it.
 * - practice*: a daily rate limit, not progress. Syncing a counter that
 *   resets at midnight would need columns and a timezone argument, and the
 *   worst it buys is one extra round of revision.
 * - daily*: the rotating daily missions' counters and claimed state. Same
 *   reasoning as practice*: a per-day rate limit rather than progress, and
 *   which three missions are on offer is a pure function of the date, so
 *   there's nothing here a second device couldn't recompute for itself.
 *
 * frozenDates and reviewDates used to be here too, kept local so a laptop
 * never showed a frozen day for a gap it never lived through. That also
 * meant a reinstall recovered the streak number and the protector count
 * from the cloud but silently lost which days had earned them — the
 * calendar going blank where it should have shown blue. They're progress,
 * the same as the streak they explain, so they're synced now.
 */
const LOCAL_ONLY = new Set([
  'testMode',
  'practiceDay',
  'practiceRoundsToday',
  'lessonsSincePitch',
  'lastStreakLoss',
  'reminderEnabled',
  'reminderHour',
  'heartsReminderEnabled',
  'dailyStatsDate',
  'dailyXp',
  'dailyLessons',
  'dailyPerfectLessons',
  'dailyCorrect',
  'dailyReviews',
  'dailyMissionsDate',
  'claimedDailyMissionIds',
]);

/**
 * The opposite asymmetry from LOCAL_ONLY: these come *from* the cloud —
 * pulled by fromRow, present in PulledProfile — but are deliberately absent
 * from CloudState/toRow, because nothing on this device is the one allowed
 * to decide them. league_rank, league_table_id and league_week_start are
 * server-owned: only the weekly reset and join_league_if_needed() (both
 * running as the database, not the client) ever write them. Pushing back
 * whatever stale copy this device happened to have would be exactly the bug
 * that cost the streak calendar its frozen days before frozenDates synced —
 * except unrecoverable here, since it would overwrite a value the server
 * just computed with one the client made up.
 */
const SERVER_OWNED = new Set(['leagueRank', 'leagueTableId', 'leagueWeekStart']);

for (const key of persistedKeys) {
  if (LOCAL_ONLY.has(key)) {
    check(`"${key}" is deliberately kept off the cloud`, !cloudKeys.has(key));
    continue;
  }
  if (SERVER_OWNED.has(key)) {
    check(`"${key}" is read from the cloud but never written back`, !cloudKeys.has(key));
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
  // Two shapes count: a column in the original create table, and one bolted
  // on later by an alter. Only matching the first would push every new field
  // into 0001, which is what having migrations at all is meant to stop.
  const declared =
    new RegExp(String.raw`\n\s+${column}\s`).test(sql) ||
    new RegExp(String.raw`add column (if not exists )?${column}\s`).test(sql);
  check(`the profiles table declares "${column}"`, declared, `missing from ${migrationDir}`);
}

// Server-owned columns don't come from toRow's output, so the loop above
// never looks for them — checked by hand instead, same regex.
for (const column of ['league_rank', 'league_table_id', 'league_week_start']) {
  const declared =
    new RegExp(String.raw`\n\s+${column}\s`).test(sql) ||
    new RegExp(String.raw`add column (if not exists )?${column}\s`).test(sql);
  check(`the profiles table declares "${column}"`, declared, `missing from ${migrationDir}`);
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

// ------------------------------- what a friend is allowed to see about you
// The numbers on a friend's card come from tables the caller cannot read, so
// the function is the only door. If it ever stops checking the friendship, or
// starts returning the attempt rows instead of an aggregate, anybody could
// read anybody.
const friendSql = readFileSync('supabase/migrations/0007_friend_profile.sql', 'utf8');
check('friend_profile only answers for accepted friends', /are_friends\(auth\.uid\(\), other\)/.test(friendSql));
check('it runs as definer, since the caller cannot read those tables', /security definer/.test(friendSql));
check('it pins the search path, like every other definer function', /set search_path = ''/.test(friendSql));
check('accuracy leaves as a percentage, not as the answers behind it', /round\(100\.0 \* sum/.test(friendSql));
check('anonymous callers cannot execute it', /revoke all on function public\.friend_profile/.test(friendSql));

// A friend's league travels with the rest of their profile — and the list
// gains it too, so the ladder shows without opening anything.
const friendLeagueSql = readFileSync('supabase/migrations/0014_friend_league.sql', 'utf8');
check(
  'friend_list y friend_profile devuelven la liga',
  /friend_list[\s\S]*league_rank/.test(friendLeagueSql) &&
    /friend_profile[\s\S]*p\.league_rank/.test(friendLeagueSql)
);
check(
  'y siguen detrás de sus puertas',
  /are_friends\(auth\.uid\(\), other\)/.test(friendLeagueSql) &&
    /auth\.uid\(\) in \(f\.requester_id, f\.addressee_id\)/.test(friendLeagueSql)
);
check(
  'reemplazan la definición anterior en vez de duplicarla',
  /drop function if exists public\.friend_list\(\)/.test(friendLeagueSql) &&
    /drop function if exists public\.friend_profile\(uuid\)/.test(friendLeagueSql)
);

// The calendar a friend's streak claims, with the same door as the rest of it.
const calendarSql = readFileSync('supabase/migrations/0012_friend_streak_calendar.sql', 'utf8');
check(
  "a friend's calendar is still behind the friendship check",
  /are_friends\(auth\.uid\(\), other\)/.test(calendarSql)
);
check(
  'it hands over dates, never the timestamps behind them',
  /::date/.test(calendarSql) && !/completed_at as/.test(calendarSql)
);
check(
  'and only a recent window of them',
  /interval '60 days'/.test(calendarSql)
);
check(
  'the newer definition replaces the old one rather than shadowing it',
  /drop function if exists public\.friend_profile\(uuid\)/.test(calendarSql)
);

// ------------------------------------------------------------- the leagues
// A player's table is the one door onto other players' rows; if it ever
// stopped scoping to the caller's own league_table_id, anybody's weekly XP
// would be readable by anybody. And nothing client-facing may ever call the
// reset directly — only the cron schedule may end everyone's week.
const leagueSql = readFileSync('supabase/migrations/0009_leagues.sql', 'utf8');
check(
  'league_leaderboard only answers for the caller\'s own table',
  // Matched on the property rather than on one exact spelling of it: the
  // clause is `p.league_table_id = (select … where id = auth.uid())`, and the
  // check was demanding it without the alias, so it failed on SQL that was
  // doing precisely what it asks.
  /league_table_id\s*=\s*\(\s*select\s+league_table_id\s+from\s+public\.profiles\s+where\s+id\s*=\s*auth\.uid\(\)\s*\)/.test(
    leagueSql
  )
);
check('join_league_if_needed turns away anonymous accounts', /is_anonymous = false/.test(leagueSql));
check(
  'both league functions run as definer, since the caller cannot read other rows',
  (leagueSql.match(/security definer/g) ?? []).length >= 3
);
check(
  'the weekly reset cannot be called by a client',
  /revoke all on function public\.run_weekly_league_reset\(\) from public;/.test(leagueSql) &&
    !/grant execute on function public\.run_weekly_league_reset/.test(leagueSql)
);
check('the reset is scheduled, not left to run by hand', /cron\.schedule\(/.test(leagueSql));
check(
  'promotion and relegation only trigger on a table big enough for them to be fair',
  /table_size > 4/.test(leagueSql) && /table_size > 1/.test(leagueSql)
);

// ------------------------------------------ how a failed write is classified
// Both of these fail identically on every later attempt too, so getting the
// mapping wrong means progress stops syncing with nothing on screen saying so.
check('a unique violation is read as a taken nickname', classifyWriteError('23505') === 'name-taken');
check('a foreign key violation is read as a deleted account', classifyWriteError('23503') === 'no-account');
check('anything else is just a failure', classifyWriteError('42501') === 'failed');
check('a missing code is a failure, not a guess', classifyWriteError(undefined) === 'failed');

// ------------------------------- a failed read is not an empty account
// pullState used to answer null for both, and the caller reads "nothing there"
// as permission to seed the account from this device. On a device that has
// just been cleared that means writing an empty profile over a real one.
const pullSource = readFileSync('src/lib/cloud.ts', 'utf8');
check(
  'pullState distinguishes a failed read from an empty account',
  /status: 'error'/.test(pullSource) && /status: 'empty'/.test(pullSource)
);
const syncSource = readFileSync('src/hooks/useCloudSync.ts', 'utf8');
check(
  'a failed read never seeds the account from this device',
  /remote\.status === 'error'[\s\S]{0,400}?return;/.test(syncSource)
);
check(
  'only a genuinely empty account gets seeded',
  /remote\.status === 'found' && hasProgress/.test(syncSource)
);
check(
  'concurrent callers share one sign-in, so two never race to create accounts',
  /sessionInFlight/.test(pullSource)
);

// ------------------------- a schema that's behind doesn't stop all syncing
// Adding a field to the client before running the migration used to mean every
// write failed, not just that field's — PostgREST rejects the whole row.
check(
  'a column the database does not have yet is dropped and the row retried',
  /PGRST204/.test(pullSource) && /delete row\[missing\]/.test(pullSource)
);

// --------------------------------- the deep link scheme agrees everywhere
// Three files have to name the same scheme, and none of them can see the
// others. A mismatch shows up as a sign-in that opens the browser, succeeds,
// and then simply never comes back — with nothing anywhere saying why.
const nativeAuth = readFileSync('src/lib/nativeAuth.ts', 'utf8');
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const plist = readFileSync('ios/App/App/Info.plist', 'utf8');

const scheme = nativeAuth.match(/NATIVE_SCHEME = '([^']+)'/)?.[1];
check('nativeAuth.ts declares a scheme', !!scheme, scheme ?? 'none');
check(
  'AndroidManifest registers the same scheme',
  !!scheme && new RegExp(`android:scheme="${scheme}"`).test(manifest)
);
check(
  'Info.plist registers the same scheme',
  !!scheme && new RegExp(`<string>${scheme.replace(/\./g, '\\.')}</string>`).test(plist)
);
check(
  'the Android intent filter is browsable, or the browser cannot reopen the app',
  /android\.intent\.category\.BROWSABLE/.test(manifest)
);

// -------------------------------------------- which side wins on first sync
check('a fresh cloud profile does not count as progress', !hasProgress({ onboarded: false, xp: 0, attempts: [] }));
check('an onboarded profile counts', hasProgress({ onboarded: true, xp: 0, attempts: [] }));
check('xp alone counts', hasProgress({ onboarded: false, xp: 10, attempts: [] }));
check('a lesson history alone counts', hasProgress({ onboarded: false, xp: 0, attempts: sample.attempts }));

console.log(failures === 0 ? '\nAll cloud checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
