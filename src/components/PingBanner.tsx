import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from './Mascot';
import Icon from './Icon';
import { fetchPings, markPingsSeen, type Ping } from '../lib/friends';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Shows nudges from friends when the app is open.
 *
 * This is where a ping would ideally arrive as a push notification, and on iOS
 * it currently can't: a free Apple ID has no aps-environment entitlement, so a
 * sideloaded build cannot receive remote push at all. Until there is a paid
 * account, a ping waits in the inbox and is delivered the next time the app is
 * opened — which is still the moment it matters, since the point is to get
 * someone back into a lesson.
 */

/** Only while the tab is open and focused; there is nothing real-time here. */
const POLL_MS = 120_000;

export default function PingBanner() {
  const status = useAuthStore((s) => s.status);
  const [pings, setPings] = useState<Ping[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'off' || status === 'loading') return;

    let cancelled = false;
    const load = async () => {
      const inbox = await fetchPings();
      if (!cancelled) setPings(inbox);
    };

    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status]);

  if (!pings.length) return null;

  const [latest] = pings;
  const others = pings.length - 1;

  const dismiss = async () => {
    setPings([]);
    await markPingsSeen();
  };

  return (
    <div className="fixed left-4 right-4 bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[360px] z-50 animate-pop-in">
      <div className="bg-carbon-850 border-2 border-lime-500/40 rounded-2xl p-4 flex items-start gap-3 shadow-xl">
        <Mascot size={40} look={latest.fromAvatar} />

        <div className="flex-1 min-w-0">
          <p className="font-black text-carbon-50">
            {latest.fromName} te ha dado un toque
          </p>
          <p className="text-sm text-carbon-400">
            {others > 0
              ? `Y ${others} ${others === 1 ? 'persona más' : 'personas más'}. Te echan de menos.`
              : 'Te toca practicar.'}
          </p>
          <button
            onClick={() => {
              void dismiss();
              navigate('/home');
            }}
            className="mt-2 text-[13px] font-black uppercase tracking-[0.8px] text-lime-400 hover:text-lime-300"
          >
            Empezar una lección
          </button>
        </div>

        <button
          onClick={() => void dismiss()}
          aria-label="Descartar"
          className="shrink-0 text-carbon-600 hover:text-carbon-300 transition p-1 -mt-1 -mr-1"
        >
          <Icon name="close" size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
