import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Button } from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { formatCountdown } from '../hooks/useHeartRegen';
import {
  listFriends,
  pingCooldownRemaining,
  pingFriend,
  removeFriend,
  requestFriend,
  respondToRequest,
  type Friend,
} from '../lib/friends';
import { useAuthStore } from '../store/useAuthStore';
import { NAME_MAX } from '../lib/names';

function FriendRow({
  friend,
  onChanged,
  flash,
  onRequestRemove,
}: {
  friend: Friend;
  onChanged: () => void;
  flash: (message: string) => void;
  onRequestRemove: (friend: Friend) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const isCoolingDown = cooldownMs > 0;

  // Reads the real cooldown from the server (see pingCooldownRemaining):
  // it's the source of truth, so this refreshes whenever the row mounts or
  // the friend changes rather than trusting whatever stale local guess was
  // left over from a previous session.
  useEffect(() => {
    let cancelled = false;
    void pingCooldownRemaining(friend.id).then((ms) => {
      if (!cancelled) setCooldownMs(ms);
    });
    return () => {
      cancelled = true;
    };
  }, [friend.id]);

  // Ticks the countdown down locally once it's known, instead of asking the
  // server every second — a network round trip per tick would be wasteful
  // and laggy for something that's just decorating a button.
  useEffect(() => {
    if (!isCoolingDown) return;
    const id = setInterval(() => setCooldownMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(id);
  }, [isCoolingDown]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    onChanged();
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b-2 border-carbon-800 last:border-b-0">
      <Mascot size={44} look={friend.avatar} />

      <div className="flex-1 min-w-0">
        <p className="font-black text-carbon-50 truncate">{friend.name}</p>
        <p className="text-sm text-carbon-400 flex items-center gap-2.5 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Icon name="flame" size={14} className={friend.streak > 0 ? 'text-lime-500' : 'text-carbon-600'} />
            {friend.streak}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="star" size={14} className="text-lime-500" />
            {friend.xp}
          </span>
        </p>
      </div>

      {friend.relation === 'friend' && (
        <div className="shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            fullWidth={false}
            disabled={busy || cooldownMs > 0}
            onClick={() =>
              void run(async () => {
                const { message } = await pingFriend(friend.id);
                flash(message);
                setCooldownMs(await pingCooldownRemaining(friend.id));
              })
            }
          >
            {cooldownMs > 0 ? formatCountdown(cooldownMs) : 'Toque'}
          </Button>
          <button
            onClick={() => onRequestRemove(friend)}
            disabled={busy}
            aria-label={`Eliminar a ${friend.name}`}
            className="text-carbon-600 hover:text-danger-400 transition p-1"
          >
            <Icon name="close" size={18} strokeWidth={2.4} />
          </button>
        </div>
      )}


      {friend.relation === 'incoming' && (
        <div className="shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            fullWidth={false}
            disabled={busy}
            onClick={() => void run(() => respondToRequest(friend.id, true))}
          >
            Aceptar
          </Button>
          <button
            onClick={() => void run(() => respondToRequest(friend.id, false))}
            disabled={busy}
            aria-label={`Rechazar a ${friend.name}`}
            className="text-carbon-600 hover:text-danger-400 transition p-1"
          >
            <Icon name="close" size={18} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {friend.relation === 'outgoing' && (
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-carbon-500">Pendiente</span>
          <button
            onClick={() => void run(() => removeFriend(friend.id))}
            disabled={busy}
            aria-label={`Cancelar la solicitud a ${friend.name}`}
            className="text-carbon-600 hover:text-danger-400 transition p-1"
          >
            <Icon name="close" size={18} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function Friends() {
  const authStatus = useAuthStore((s) => s.status);
  const [rows, setRows] = useState<Friend[]>([]);
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Friend | null>(null);
  const [removing, setRemoving] = useState(false);

  const reload = useCallback(async () => {
    setRows(await listFriends());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || sending) return;
    setSending(true);
    const { ok, message: text } = await requestFriend(nickname);
    setSending(false);
    flash(text);
    if (ok) {
      setNickname('');
      void reload();
    }
  };

  const incoming = rows.filter((r) => r.relation === 'incoming');
  const friends = rows.filter((r) => r.relation === 'friend');
  const outgoing = rows.filter((r) => r.relation === 'outgoing');

  const confirmRemoveFriend = async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    await removeFriend(confirmRemove.id);
    setRemoving(false);
    setConfirmRemove(null);
    void reload();
  };

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden">
          <TopBar />
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <h1 className="text-2xl font-black text-carbon-50">Amigos</h1>
          <p className="text-sm text-carbon-400 mt-1">
            Búscalos por su apodo. Dales un toque cuando lleven días sin aparecer.
          </p>

          {/* An anonymous account dies with this browser, and so would every
              friendship attached to it. Worth saying before they build a list. */}
          {authStatus === 'anonymous' && (
            <p className="mt-4 rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/10 px-4 py-3 text-sm font-bold text-[#FFC93C]">
              Guarda tu cuenta antes de añadir amigos, o los perderás con este dispositivo.
            </p>
          )}

          <form onSubmit={send} className="mt-4 flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="Apodo de tu amigo"
              className="flex-1 min-w-0 h-[50px] px-4 rounded-xl bg-carbon-850 border-2 border-carbon-700 focus:border-lime-500 outline-none text-carbon-50 font-bold placeholder:text-carbon-600 placeholder:font-medium"
            />
            <Button type="submit" fullWidth={false} disabled={sending || !nickname.trim()}>
              Añadir
            </Button>
          </form>

          {message && (
            <p className="mt-3 text-sm font-black text-lime-400 bg-lime-500/10 border-2 border-lime-500/30 rounded-xl px-4 py-3 animate-pop-in">
              {message}
            </p>
          )}

          {loading ? (
            <p className="mt-6 text-sm text-carbon-500">Cargando…</p>
          ) : (
            <>
              {incoming.length > 0 && (
                <>
                  <h2 className="mt-8 text-[19px] font-black text-carbon-50">
                    Te han pedido amistad ({incoming.length})
                  </h2>
                  <div className="mt-2 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
                    {incoming.map((f) => (
                      <FriendRow key={f.id} friend={f} onChanged={reload} flash={flash} onRequestRemove={setConfirmRemove} />
                    ))}
                  </div>
                </>
              )}

              <h2 className="mt-8 text-[19px] font-black text-carbon-50">
                Tus amigos {friends.length > 0 && `(${friends.length})`}
              </h2>
              {friends.length === 0 ? (
                <p className="mt-2 text-sm text-carbon-400 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-5 text-center">
                  Aún no tienes a nadie. Pídele su apodo a alguien — está en su{' '}
                  <Link to="/profile" className="font-black text-lime-400">
                    perfil
                  </Link>
                  .
                </p>
              ) : (
                <div className="mt-2 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
                  {friends.map((f) => (
                    <FriendRow key={f.id} friend={f} onChanged={reload} flash={flash} onRequestRemove={setConfirmRemove} />
                  ))}
                </div>
              )}

              {outgoing.length > 0 && (
                <>
                  <h2 className="mt-8 text-[19px] font-black text-carbon-50">Esperando respuesta</h2>
                  <div className="mt-2 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
                    {outgoing.map((f) => (
                      <FriendRow key={f.id} friend={f} onChanged={reload} flash={flash} onRequestRemove={setConfirmRemove} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {confirmRemove && (
        <ConfirmModal
          title={`¿Eliminar a ${confirmRemove.name}?`}
          message="Dejaréis de ser amigos y tendrás que enviarle otra solicitud si cambias de idea."
          confirmLabel="Eliminar"
          busy={removing}
          onConfirm={() => void confirmRemoveFriend()}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
