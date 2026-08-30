import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Mascot from './Mascot';
import PlanBadge from './PlanBadge';
import LeagueMark from './LeagueMark';
import Icon from './Icon';
import { Button, ButtonLink } from './Button';
import { listFriends, type Friend } from '../lib/friends';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';

/*
 * The friends list as it appears on the profile.
 *
 * Measurements from the reference profile: a 24px/700 section heading, rows of
 * a 20px/700 name over its XP, and a foot that reads "ver N más" across the
 * card's full width rather than being a button in its own right. Three rows
 * before the fold — enough to look like a list, short enough that what follows
 * still exists on a phone.
 *
 * Friends used to be a tab of its own. It isn't any more, so this panel is now
 * the only place an incoming request can be noticed: it goes above the list and
 * wears the accent colour, because a request nobody sees is a friendship that
 * never happens.
 */

const PREVIEW = 3;

/** How long the invite confirmation stays on screen. */
const FLASH_MS = 3000;

/* A whole row is the target, not a name inside it: on a phone the difference
   between hitting a link and hitting the gap beside it is the difference
   between the feature existing and not. */
function FriendPreviewRow({ friend }: { friend: Friend }) {
  return (
    <Link
      to={`/amigos/${friend.id}`}
      className="flex items-center gap-3 py-4 border-b-2 border-carbon-800 last:border-b-0 -mx-4 px-4 hover:bg-carbon-800/40 transition"
    >
      <Mascot size={44} look={friend.avatar} />

      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 min-w-0">
          <span className="text-[20px] font-black text-carbon-50 leading-tight truncate">
            {friend.name}
          </span>
          <PlanBadge plan={friend.plan} size="sm" />
        </p>
        <p className="text-sm text-carbon-400 tabular-nums">{friend.xp} XP</p>
      </div>

      <LeagueMark rank={friend.leagueRank} size={30} />

      {friend.streak > 0 && (
        <span className="shrink-0 inline-flex items-center gap-1 text-sm font-black text-carbon-300 tabular-nums">
          <Icon name="flame" size={16} className="text-lime-500" />
          {friend.streak}
        </span>
      )}

      <Icon name="chevron-left" size={18} className="shrink-0 text-carbon-600 rotate-180" />
    </Link>
  );
}

export default function FriendsPanel() {
  const authStatus = useAuthStore((s) => s.status);
  const myName = useUserStore((s) => s.name);
  /** null while the list is still on its way, so "cargando" and "no tienes a
   *  nadie" can't be mistaken for each other. */
  const [rows, setRows] = useState<Friend[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    // Nothing is known yet while the session resolves; with the cloud switched
    // off there is nothing to know at all, and an empty list is the truth.
    if (authStatus === 'loading') return;
    if (authStatus === 'off') {
      setRows([]);
      return;
    }

    let cancelled = false;
    void listFriends().then((list) => {
      if (!cancelled) setRows(list);
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const say = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), FLASH_MS);
  };

  const nickname = myName || 'Trader';

  const invite = async () => {
    const text = `Estoy aprendiendo a invertir en Stonksu. Búscame como "${nickname}" y añádeme.`;

    // The native share sheet inside the Capacitor WebView, and on most phone
    // browsers. A desktop without it gets the same text on the clipboard, so
    // the button does something real either way — and if even that is blocked
    // (it needs a secure context), the nickname is at least said out loud.
    if (navigator.share) {
      // Dismissing the sheet rejects, which is not a failure worth reporting.
      await navigator.share({ text }).catch(() => {});
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      say('Invitación copiada. Pégala donde quieras.');
    } catch {
      say(`Diles que te busquen como "${nickname}".`);
    }
  };

  const incoming = rows?.filter((r) => r.relation === 'incoming') ?? [];
  const friends = [...(rows?.filter((r) => r.relation === 'friend') ?? [])].sort((a, b) => b.xp - a.xp);
  const hidden = Math.max(0, friends.length - PREVIEW);

  return (
    <>
      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-carbon-50">Amigos</h2>
        {friends.length > 0 && (
          <Link
            to="/amigos"
            className="text-[15px] font-black uppercase tracking-[0.8px] text-lime-400 hover:text-lime-300"
          >
            Ver todos
          </Link>
        )}
      </div>

      {incoming.length > 0 && (
        <Link
          to="/amigos"
          className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-lime-500/40 bg-lime-500/10 px-4 py-3 hover:border-lime-500/70 transition"
        >
          <Icon name="users" size={22} className="text-lime-400 shrink-0" />
          <p className="flex-1 text-sm font-black text-lime-400">
            {incoming.length === 1
              ? `${incoming[0].name} quiere ser tu amigo`
              : `${incoming.length} personas quieren ser tus amigos`}
          </p>
          <Icon name="chevron-left" size={20} className="text-lime-400 shrink-0 rotate-180" />
        </Link>
      )}

      {rows === null ? (
        <p className="mt-3 text-sm text-carbon-500">Cargando…</p>
      ) : friends.length === 0 ? (
        <p className="mt-3 text-sm text-carbon-400 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-5 text-center">
          Aún no tienes a nadie aquí. Pide su apodo a alguien y añádelo — el tuyo es{' '}
          <span className="font-black text-carbon-200">{nickname}</span>.
        </p>
      ) : (
        <div className="mt-3 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
          {friends.slice(0, PREVIEW).map((f) => (
            <FriendPreviewRow key={f.id} friend={f} />
          ))}

          {/* Pulled out to the card's edges so its rule spans the whole width,
              the way the rows' separators do. The row above it is the rule —
              hence no border of its own, or the two would stack. */}
          {hidden > 0 && (
            <Link
              to="/amigos"
              className="-mx-4 px-4 flex h-[54px] items-center justify-center text-[17px] font-black text-carbon-50 hover:text-lime-400 transition"
            >
              Ver {hidden} más
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
        <ButtonLink to="/amigos">Añadir amigos</ButtonLink>
        <Button variant="secondary" onClick={() => void invite()}>
          Invitar amigos
        </Button>
      </div>

      {flash && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm font-black text-lime-400 bg-lime-500/10 border-2 border-lime-500/30 rounded-xl px-4 py-3 animate-pop-in"
        >
          {flash}
        </p>
      )}
    </>
  );
}
