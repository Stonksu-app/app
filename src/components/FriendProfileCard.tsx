import { useEffect, useState } from 'react';
import Icon from './Icon';
import Mascot from './Mascot';
import PlanBadge from './PlanBadge';
import { Button } from './Button';
import { fetchFriendProfile, type FriendProfile } from '../lib/friends';

/*
 * What you get for adding somebody.
 *
 * A friends list where each row is a name and a number is an address book. The
 * reason to bring people in is seeing how they're doing and being seen back —
 * so this shows the four things that actually say that: the streak, the XP,
 * how accurate they are, and how much of the course they've finished.
 *
 * Everything here is aggregated on the server. Their answers stay theirs; what
 * crosses the wire is how often they got them right.
 */

function Stat({
  icon,
  value,
  label,
  tone = 'text-lime-500',
}: {
  icon: 'flame' | 'star' | 'target' | 'book';
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl bg-carbon-800 px-3 py-3 text-center">
      <Icon name={icon} size={18} className={`mx-auto ${tone}`} />
      <p className="mt-1 text-lg font-black text-carbon-50 tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-carbon-500">{label}</p>
    </div>
  );
}

export default function FriendProfileCard({
  friendId,
  onClose,
}: {
  friendId: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await fetchFriendProfile(friendId);
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friendId]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-carbon-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-carbon-900 border-2 border-carbon-800 rounded-3xl p-6 animate-pop-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Perfil del amigo"
      >
        {loading ? (
          <p className="py-8 text-center text-sm font-bold text-carbon-500">Cargando…</p>
        ) : !profile ? (
          <>
            <p className="text-center font-black text-carbon-100">No se pudo abrir el perfil</p>
            <p className="mt-1 text-center text-sm text-carbon-400">
              Solo puedes ver el perfil de quien ya es amigo tuyo.
            </p>
            <div className="mt-6">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Mascot size={64} look={profile.avatar} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-xl font-black text-carbon-50 truncate">{profile.name}</h2>
                  <PlanBadge plan={profile.plan} size="sm" />
                </div>
                <p className="text-[13px] text-carbon-500">
                  Desde {new Date(profile.memberSince).toLocaleDateString('es-ES', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Stat icon="flame" value={String(profile.streak)} label="Días de racha" />
              <Stat icon="star" value={String(profile.xp)} label="XP" />
              {/* Never answered anything is not the same as answering
                  everything wrong, so it says so rather than showing 0%. */}
              <Stat
                icon="target"
                value={profile.accuracy === null ? '—' : `${profile.accuracy}%`}
                label="Aciertos"
                tone="text-ultra-400"
              />
              <Stat icon="book" value={String(profile.lessons)} label="Lecciones" />
            </div>

            <div className="mt-6">
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
