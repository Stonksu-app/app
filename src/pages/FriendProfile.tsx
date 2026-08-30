import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import PlanBadge from '../components/PlanBadge';
import { MonthGrid } from '../components/StreakCalendar';
import { Button } from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { fetchFriendProfile, pingFriend, removeFriend, type FriendProfile } from '../lib/friends';
import { useUserStore } from '../store/useUserStore';
import { inferredFrozenDays } from '../utils/streak';
import type { IconName } from '../types';

/*
 * A friend's profile, as a page rather than a dialog.
 *
 * A dialog says "here's a summary, now get back to what you were doing". A
 * page says the person is somewhere you can go, which is the whole point of
 * having friends in the app at all — and it's a link you can be sent, land on,
 * and share, which a modal can never be.
 */

function Stat({
  icon,
  value,
  label,
  tone = 'text-lime-500',
  onClick,
  open,
}: {
  icon: IconName;
  value: string;
  label: string;
  tone?: string;
  /** Present when the tile opens something — the streak's calendar. */
  onClick?: () => void;
  open?: boolean;
}) {
  const body = (
    <>
      <Icon name={icon} size={20} className={tone} />
      <p className="mt-1.5 text-2xl font-black text-carbon-50 tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-carbon-500">
        {label}
        {onClick && (
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            className="text-carbon-500"
          />
        )}
      </p>
    </>
  );

  const shell = 'rounded-2xl border-2 px-4 py-4 text-left w-full';
  // Tapping the number you're curious about is the obvious way in — no
  // separate "ver calendario" button to find first.
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`${shell} transition ${
        open
          ? 'border-lime-500/50 bg-carbon-800'
          : 'border-carbon-800 bg-carbon-850 hover:border-carbon-700'
      }`}
    >
      {body}
    </button>
  ) : (
    <div className={`${shell} border-carbon-800 bg-carbon-850`}>{body}</div>
  );
}

/** Two bars on the same scale, so "more" is something you see rather than
 *  arithmetic you do. */
function Compare({
  label,
  mine,
  theirs,
  theirName,
  unit = '',
}: {
  label: string;
  mine: number;
  theirs: number;
  theirName: string;
  unit?: string;
}) {
  const top = Math.max(mine, theirs, 1);
  const row = (who: string, value: number, colour: string) => (
    <div className="flex items-center gap-2.5">
      <span className="w-24 shrink-0 truncate text-[13px] font-bold text-carbon-300">{who}</span>
      <span className="flex-1 h-3 rounded-full bg-carbon-800 overflow-hidden">
        <span
          className={`block h-full rounded-full ${colour} transition-all duration-500`}
          style={{ width: `${(value / top) * 100}%` }}
        />
      </span>
      <span className="w-16 shrink-0 text-right text-[13px] font-black text-carbon-200 tabular-nums">
        {value}
        {unit}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-4">
      <p className="text-[12px] font-black uppercase tracking-[0.8px] text-carbon-500">{label}</p>
      <div className="mt-3 space-y-2">
        {row('Tú', mine, 'bg-carbon-500')}
        {row(theirName, theirs, 'bg-lime-500')}
      </div>
    </div>
  );
}

export default function FriendProfile() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const myXp = useUserStore((s) => s.xp);
  const myStreak = useUserStore((s) => s.streak);

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  /* Their last active day is a day they were active — same rule as your own
   * calendar. Without it their profile shows a streak counting today over a
   * grid with today blank. */
  const theirActiveDays = new Set([
    ...(profile?.activeDays ?? []),
    ...(profile?.lastActive ? [profile.lastActive] : []),
  ]);
  const theirFrozenDays = new Set([
    ...(profile?.frozenDays ?? []),
    ...inferredFrozenDays(profile?.streak ?? 0, profile?.lastActive ?? null, theirActiveDays),
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const p = await fetchFriendProfile(id);
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/amigos')}
              aria-label="Volver a amigos"
              className="text-carbon-500 hover:text-carbon-200 transition p-1 -ml-1"
            >
              <Icon name="chevron-left" size={24} strokeWidth={2.4} />
            </button>
            <h1 className="text-2xl font-black text-carbon-50">Perfil</h1>
          </div>

          {loading ? (
            <p className="mt-10 text-center text-sm font-bold text-carbon-500">Cargando…</p>
          ) : !profile ? (
            <div className="mt-10 text-center">
              <Icon name="users" size={40} className="mx-auto text-carbon-600" />
              <p className="mt-4 font-black text-carbon-100">No se pudo abrir este perfil</p>
              <p className="mt-1 text-sm text-carbon-400">
                Solo puedes ver el perfil de quien ya es amigo tuyo.
              </p>
              <div className="mt-6 w-[220px] mx-auto">
                <Button onClick={() => navigate('/amigos')}>Volver a amigos</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-6 flex flex-col items-center text-center">
                <Mascot size={104} look={profile.avatar} mood="happy" />
                <div className="mt-3 flex items-center gap-2">
                  <h2 className="text-2xl font-black text-carbon-50">{profile.name}</h2>
                  <PlanBadge plan={profile.plan} />
                </div>
                <p className="mt-0.5 text-sm text-carbon-500">
                  Desde{' '}
                  {new Date(profile.memberSince).toLocaleDateString('es-ES', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                {profile.lastActive && (
                  <p className="text-sm text-carbon-500">
                    Última práctica:{' '}
                    {new Date(`${profile.lastActive}T12:00:00`).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                )}
              </div>

              <h3 className="mt-8 text-[19px] font-black text-carbon-50">Estadísticas</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat
                  icon="flame"
                  value={String(profile.streak)}
                  label="Días de racha"
                  onClick={() => setShowCalendar((v) => !v)}
                  open={showCalendar}
                />
                <Stat icon="star" value={String(profile.xp)} label="XP total" />
                {/* Never having answered is not the same as answering
                    everything wrong, so it shows a dash rather than 0%. */}
                <Stat
                  icon="target"
                  value={profile.accuracy === null ? '—' : `${profile.accuracy}%`}
                  label="Aciertos"
                  tone="text-ultra-400"
                />
                <Stat icon="book" value={String(profile.lessons)} label="Lecciones" />
              </div>

              {showCalendar && (
                <div className="mt-3 animate-pop-in">
                  {/* The same grid as your own streak panel, drawn from their
                      days — and, as with yours, the days their streak must
                      have crossed are worked out rather than needing to have
                      been witnessed. */}
                  <MonthGrid activeDays={theirActiveDays} frozenDays={theirFrozenDays} />
                  {profile.activeDays.length === 0 && (
                    <p className="mt-2 text-center text-[13px] text-carbon-500">
                      Sin días registrados todavía.
                    </p>
                  )}
                </div>
              )}

              {/* The comparison is the part that makes a friend a reason to
                  come back, rather than a name on a list. */}
              <h3 className="mt-8 text-[19px] font-black text-carbon-50">Tú y {profile.name}</h3>
              <div className="mt-3 space-y-3">
                <Compare label="XP total" mine={myXp} theirs={profile.xp} theirName={profile.name} />
                <Compare
                  label="Racha"
                  mine={myStreak}
                  theirs={profile.streak}
                  theirName={profile.name}
                />
              </div>

              {flash && (
                <p
                  role="status"
                  className="mt-5 rounded-2xl border-2 border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm font-bold text-lime-400 animate-pop-in"
                >
                  {flash}
                </p>
              )}

              <div className="mt-6 space-y-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      const { message } = await pingFriend(profile.id);
                      setFlash(message);
                      setBusy(false);
                    })()
                  }
                >
                  <Icon name="flame" size={18} /> Dar un toque
                </Button>
                <Button variant="secondary" onClick={() => setConfirmRemove(true)}>
                  Quitar de amigos
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmRemove && profile && (
        <ConfirmModal
          title={`¿Quitar a ${profile.name}?`}
          message="Dejaréis de veros el progreso. Podéis volver a agregaros cuando queráis."
          confirmLabel="Quitar"
          busy={busy}
          onConfirm={() =>
            void (async () => {
              setBusy(true);
              await removeFriend(profile.id);
              navigate('/amigos');
            })()
          }
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
