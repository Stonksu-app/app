import { useEffect, useState } from 'react';
import Icon from './Icon';
import { hasPermission, notificationsSupported, requestPermission } from '../lib/notifications';
import { useUserStore } from '../store/useUserStore';

/**
 * The hearts-refilled toggle.
 *
 * Same permission-on-toggle reasoning as ReminderSetting: iOS only shows its
 * prompt once, so it's requested here, on a deliberate flip, not on launch.
 */
export default function HeartsReminderSetting() {
  const { heartsReminderEnabled, setHeartsReminder } = useUserStore();
  const [granted, setGranted] = useState(true);
  const supported = notificationsSupported();

  useEffect(() => {
    if (supported) void hasPermission().then(setGranted);
  }, [supported]);

  const toggle = async () => {
    if (heartsReminderEnabled) return setHeartsReminder(false);

    const ok = (await hasPermission()) || (await requestPermission());
    setGranted(ok);
    if (ok) setHeartsReminder(true);
  };

  return (
    <div className="mt-4 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Icon name="heart" size={24} className="text-danger-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[19px] font-black text-carbon-50">Aviso de vidas</h2>
          <p className="text-sm text-carbon-400 mt-0.5">
            {supported
              ? 'Un aviso cada vez que se te recargue una vida, y otro cuando estén todas.'
              : 'Solo en la app del móvil. En el navegador no hay avisos.'}
          </p>
        </div>

        <button
          onClick={() => void toggle()}
          disabled={!supported}
          role="switch"
          aria-checked={heartsReminderEnabled}
          aria-label="Aviso de vidas"
          className={`shrink-0 w-[52px] h-8 rounded-full border-2 transition-colors relative disabled:opacity-40 ${
            heartsReminderEnabled ? 'bg-lime-500 border-lime-500' : 'bg-carbon-800 border-carbon-700'
          }`}
        >
          <span
            className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-carbon-950 transition-all ${
              heartsReminderEnabled ? 'left-[25px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>

      {supported && !granted && (
        <p className="mt-3 text-sm font-bold text-[#FFC93C]">
          Has bloqueado las notificaciones. Actívalas en los ajustes del móvil para Stonksu.
        </p>
      )}
    </div>
  );
}
