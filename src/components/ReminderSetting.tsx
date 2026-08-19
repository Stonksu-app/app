import { useEffect, useState } from 'react';
import Icon from './Icon';
import { hasPermission, notificationsSupported, requestPermission } from '../lib/notifications';
import { useUserStore } from '../store/useUserStore';

/** Evening hours are what a streak reminder is for; a 3am option is noise. */
const HOURS = [9, 12, 15, 18, 20, 21, 22];

/**
 * The streak reminder toggle.
 *
 * Permission is requested here and nowhere else, because iOS shows its prompt
 * exactly once per install. Asking on launch would spend that single chance
 * before the player has any idea what they are being asked for; asking when
 * they deliberately flip a switch labelled "remind me" gets a yes.
 */
export default function ReminderSetting() {
  const { reminderEnabled, reminderHour, setReminder } = useUserStore();
  const [granted, setGranted] = useState(true);
  const supported = notificationsSupported();

  useEffect(() => {
    if (supported) void hasPermission().then(setGranted);
  }, [supported]);

  const toggle = async () => {
    if (reminderEnabled) return setReminder({ enabled: false });

    const ok = (await hasPermission()) || (await requestPermission());
    setGranted(ok);
    if (ok) setReminder({ enabled: true });
  };

  return (
    <div className="mt-8 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Icon name="flame" size={24} className="text-lime-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[19px] font-black text-carbon-50">Recordatorio de racha</h2>
          <p className="text-sm text-carbon-400 mt-0.5">
            {supported
              ? 'Un aviso al día, solo si aún no has practicado.'
              : 'Solo en la app del móvil. En el navegador no hay avisos.'}
          </p>
        </div>

        <button
          onClick={() => void toggle()}
          disabled={!supported}
          role="switch"
          aria-checked={reminderEnabled}
          aria-label="Recordatorio de racha"
          className={`shrink-0 w-[52px] h-8 rounded-full border-2 transition-colors relative disabled:opacity-40 ${
            reminderEnabled ? 'bg-lime-500 border-lime-500' : 'bg-carbon-800 border-carbon-700'
          }`}
        >
          <span
            className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-carbon-950 transition-all ${
              reminderEnabled ? 'left-[25px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>

      {supported && !granted && (
        <p className="mt-3 text-sm font-bold text-[#FFC93C]">
          Has bloqueado las notificaciones. Actívalas en los ajustes del móvil para Stonksu.
        </p>
      )}

      {reminderEnabled && (
        <>
          <p className="mt-4 text-sm font-bold text-carbon-300">¿A qué hora?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => setReminder({ hour: h })}
                aria-pressed={reminderHour === h}
                className={`px-3 py-1.5 rounded-xl text-sm font-black tabular-nums border-2 transition ${
                  reminderHour === h
                    ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                    : 'border-carbon-700 text-carbon-400 hover:border-carbon-500'
                }`}
              >
                {String(h).padStart(2, '0')}:00
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
