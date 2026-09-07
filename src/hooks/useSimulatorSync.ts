import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudEnabled } from '../lib/supabase';
import { emptySimulator, readSimulator, sameSimulator, simulatorState, writeSimulator, type SimulatorSnapshot, type SimulatorState } from '../lib/simulatorSync';
import { useSyncStore } from '../store/useSyncStore';
import { useUserStore } from '../store/useUserStore';
import { pushState } from '../lib/cloud';
import { snapshot } from './useCloudSync';

/** Trading waits for server acknowledgement. Lesson sync must never write this document. */
export function useSimulatorSync() {
  const userId = useSyncStore(s => s.userId);
  const profileStatus = useSyncStore(s => s.status);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>(isCloudEnabled ? 'loading' : 'ready');
  const [message, setMessage] = useState('');
  const session = useRef(0);
  const busy = useRef(false);
  const current = useRef<SimulatorSnapshot | null>(null);

  const adopt = useCallback((remote: SimulatorSnapshot) => {
    current.current = { ...remote, state: remote.state ?? emptySimulator() };
    const local = useUserStore.getState();
    // Preserve unsaved lesson earnings when the simulator revision didn't change.
    const coins = local.simulatorRevision === remote.revision ? local.coins : remote.coins;
    if (local.simulatorRevision !== remote.revision || local.simulatorOwnerId !== userId || !sameSimulator(simulatorState(local), current.current.state!)) {
      useUserStore.setState({ ...current.current.state!, coins, simulatorRevision: remote.revision, simulatorOwnerId: userId });
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!isCloudEnabled || !userId || profileStatus !== 'ready' || busy.current) return;
    busy.current = true;
    const generation = session.current;
    try {
      let remote = await readSimulator();
      if (generation !== session.current) return;
      if (remote.state === null) {
        const local = useUserStore.getState();
        // Only bootstrap once, and never copy another account's cached position.
        const seed = local.simulatorOwnerId === userId ? simulatorState(local) : emptySimulator();
        // Visiting on a new phone must not initialize an empty record before
        // the old computer has a chance to import its existing operation.
        if (seed.openTrade || seed.pendingOrder || seed.tradeHistory.length || seed.tradesToday) {
          if (await pushState(userId, snapshot()) !== 'ok') throw new Error('No se pudo guardar el saldo');
          if (generation !== session.current) return;
          remote = await writeSimulator(remote.revision, seed);
          if (generation !== session.current) return;
        }
      }
      adopt(remote);
      setStatus('ready');
      setMessage('');
    } catch (error) {
      if (generation !== session.current) return;
      console.warn('[simulator] sync failed', error);
      setMessage('No pudimos comprobar tus operaciones. Revisa la conexión y vuelve a intentar.');
      setStatus('error');
    } finally { if (generation === session.current) busy.current = false; }
  }, [userId, profileStatus, adopt]);

  useEffect(() => {
    session.current++;
    current.current = null;
    busy.current = false;
    if (!isCloudEnabled) return;
    setStatus(profileStatus === 'error' ? 'error' : 'loading');
    if (profileStatus === 'error') setMessage('No pudimos conectar con tu cuenta. Reintenta para comprobar tus operaciones.');
    void refresh();
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = setInterval(resume, 3000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    const generation = session.current;
    return () => {
      session.current = generation + 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
    };
  }, [refresh, profileStatus]);

  const commit = async (change: (state: SimulatorState) => { state: SimulatorState; coinDelta?: number } | null) => {
    if (busy.current || (isCloudEnabled && (status !== 'ready' || !current.current))) return false;
    const next = change(isCloudEnabled ? current.current!.state! : simulatorState(useUserStore.getState()));
    if (!next) return false;
    if (!isCloudEnabled) {
      useUserStore.setState({ ...next.state, coins: Math.max(0, useUserStore.getState().coins + (next.coinDelta ?? 0)) });
      return true;
    }
    const generation = session.current;
    busy.current = true;
    setStatus('saving');
    try {
      // Flush recent lesson rewards before settling against the server balance.
      // Its revision guard rejects stale balances from another device.
      if (!userId || await pushState(userId, snapshot()) !== 'ok') throw new Error('No se pudo guardar el saldo');
      if (generation !== session.current) return false;
      const remote = await writeSimulator(current.current!.revision, next.state, next.coinDelta);
      if (generation !== session.current) return false;
      adopt(remote);
      setStatus('ready');
      setMessage(remote.accepted ? '' : 'Tu operación cambió en otro dispositivo. Hemos actualizado el estado.');
      return remote.accepted === true;
    } catch (error) {
      if (generation !== session.current) return false;
      console.warn('[simulator] commit failed', error);
      // The server may have committed before the response was lost. Read before retrying.
      setMessage('No pudimos confirmar el cambio. Comprueba el estado antes de volver a operar.');
      setStatus('error');
      return false;
    } finally { if (generation === session.current) busy.current = false; }
  };

  return { ready: !isCloudEnabled || (status === 'ready' && profileStatus === 'ready'), status, message,
    refresh: () => profileStatus === 'error' ? window.location.reload() : refresh(), commit };
}
