/**
 * Nickname rules.
 *
 * The uniqueness itself is a unique index and can only be trusted to Postgres.
 * What is checked here is everything around it: the format rules a player sees
 * while typing, and the suffixing that rescues a sync when two people claim the
 * same nickname in the same instant.
 */
import { readFileSync } from 'node:fs';
import { validateName, suffixName, NAME_MIN, NAME_MAX } from '../src/lib/names';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ------------------------------------------------------------------- format
const accepted = ['pollo', 'Mordekai', 'jose luis', 'x_y-z.1', 'Ñandú', '한국어', 'ab3'];
for (const n of accepted) check(`"${n}" is accepted`, validateName(n) === null, validateName(n) ?? '');

const rejected: [string, string][] = [
  ['ab', 'too short'],
  ['a'.repeat(NAME_MAX + 1), 'too long'],
  ['pollo!!', 'punctuation'],
  ['<script>', 'markup'],
  ['   ', 'whitespace only is length 0 after trim, so it stays empty'],
];
for (const [n, why] of rejected) {
  if (n.trim() === '') {
    check(`"${n}" reads as empty rather than invalid`, validateName(n) === null);
    continue;
  }
  check(`"${n}" is rejected (${why})`, validateName(n) !== null);
}

check('an empty name is not an error, just unfinished', validateName('') === null);
check('surrounding spaces are ignored', validateName('  pollo  ') === null);
check(`exactly ${NAME_MIN} characters is allowed`, validateName('a'.repeat(NAME_MIN)) === null);
check(`exactly ${NAME_MAX} characters is allowed`, validateName('a'.repeat(NAME_MAX)) === null);

// ---------------------------------------------------------------- suffixing
check('the first variant is 2, not 1', suffixName('pollo', 1) === 'pollo2', suffixName('pollo', 1));
check('variants keep counting', suffixName('pollo', 2) === 'pollo3');
check(
  'a name at the limit stays within it once suffixed',
  suffixName('a'.repeat(NAME_MAX), 1).length === NAME_MAX,
  `${suffixName('a'.repeat(NAME_MAX), 1)} (${suffixName('a'.repeat(NAME_MAX), 1).length})`
);
for (let attempt = 1; attempt <= 9; attempt++) {
  const v = suffixName('a'.repeat(NAME_MAX), attempt);
  check(`variant ${attempt} of a max-length name is still valid`, validateName(v) === null, v);
}
check('a suffixed name is itself a valid name', validateName(suffixName('pollo', 1)) === null);

// ------------------------------------------------- the database backs it up
const sql = readFileSync('supabase/migrations/0003_unique_names.sql', 'utf8');
check(
  'uniqueness is enforced by an index, not by the client',
  /create unique index[\s\S]*profiles_name_unique_ci/.test(sql)
);
check('it is case-insensitive, so Pollo cannot coexist with pollo', /lower\(btrim\(name\)\)/.test(sql));
check(
  'empty names are excluded, or every fresh account would collide',
  /where btrim\(name\) <> ''/.test(sql)
);
check(
  'the availability function can see past row level security',
  /create or replace function public\.name_available[\s\S]*security definer/.test(sql)
);
check(
  'and it excludes the caller, so your own name reads as free',
  /id is distinct from auth\.uid\(\)/.test(sql)
);
check('it is not exposed more widely than logged-in users', /grant execute on function public\.name_available\(text\) to authenticated;/.test(sql));
check('pre-existing duplicates are renamed before the index is built', /row_number\(\) over \(partition by lower/.test(sql));

console.log(failures === 0 ? '\nAll name checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
