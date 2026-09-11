-- Guide practice: how well each glossary term is known.
--
-- termId -> right answers in a row, capped at TERM_MASTERY_GOAL in the client
-- (3 at the time of writing). At the cap the term counts as mastered and the
-- guide shows it in platinum. A wrong answer costs one rather than resetting,
-- so the number is a running standing rather than a streak of perfection.
--
-- Defaulted rather than nullable so a profile written before this migration
-- reads back as "nothing mastered yet" instead of null; the client also
-- coalesces, because rows created earlier keep whatever they had.

alter table public.profiles
  add column if not exists term_mastery jsonb not null default '{}'::jsonb;

comment on column public.profiles.term_mastery is
  'termId -> consecutive correct answers in the guide practice, capped by the client at TERM_MASTERY_GOAL.';
