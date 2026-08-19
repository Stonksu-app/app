import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot, { DEFAULT_LOOK } from '../components/Mascot';
import { useUserStore } from '../store/useUserStore';
import type { AccessoryStyle, EyeStyle, HornStyle, IconName, MascotLook } from '../types';

/* Header metrics from the reference: 58px bar with a 2px underline, 20px/700
 * title, and a 136x48 confirm at 16px/700 with 0.64px tracking. Edits are held
 * locally and only committed on Guardar, so backing out discards them. */

const BODY_COLORS = [
  '#C6FF34', '#8CE63C', '#47BFFF', '#7AA5FF',
  '#A78BFA', '#FF7AB6', '#FF5252', '#FFA23C',
  '#FFC93C', '#E8E8E8', '#8F8F8F', '#5FE3C0',
];

const MASK_COLORS = ['#171717', '#0a0a0a', '#1a2a33', '#2c1a33', '#33261a', '#2a0e0e'];

const HORN_OPTIONS: { id: HornStyle; label: string }[] = [
  { id: 'curvos', label: 'Curvos' },
  { id: 'rectos', label: 'Rectos' },
  { id: 'cortos', label: 'Cortos' },
  { id: 'largos', label: 'Largos' },
  { id: 'gruesos', label: 'Gruesos' },
];

const EYE_OPTIONS: { id: EyeStyle; label: string }[] = [
  { id: 'arco', label: 'Contento' },
  { id: 'puntos', label: 'Redondos' },
  { id: 'decididos', label: 'Decidido' },
  { id: 'guino', label: 'Guiño' },
  { id: 'estrellas', label: 'Estrellas' },
];

const ACCESSORY_OPTIONS: { id: AccessoryStyle; label: string }[] = [
  { id: 'ninguno', label: 'Ninguno' },
  { id: 'gorra', label: 'Gorra' },
  { id: 'corona', label: 'Corona' },
  { id: 'auriculares', label: 'Cascos' },
];

const ACCESSORY_COLORS = ['#FFC93C', '#FF5252', '#47BFFF', '#A78BFA', '#C6FF34', '#E8E8E8'];

type Tab = 'cuerpo' | 'antifaz' | 'cuernos' | 'ojos' | 'extras';
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'cuerpo', icon: 'bull', label: 'Color' },
  { id: 'antifaz', icon: 'shield', label: 'Antifaz' },
  { id: 'cuernos', icon: 'trending-up', label: 'Cuernos' },
  { id: 'ojos', icon: 'target', label: 'Ojos' },
  { id: 'extras', icon: 'sparkles', label: 'Extras' },
];

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Color ${color}`}
      aria-pressed={active}
      className={`h-14 rounded-xl border-2 transition ${
        active ? 'border-lime-400 scale-95' : 'border-carbon-700 hover:border-carbon-500'
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

function ShapeOption({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
        active ? 'border-lime-400 bg-lime-500/10' : 'border-carbon-700 hover:border-carbon-500'
      }`}
    >
      {children}
      <span className="text-[11px] font-black uppercase tracking-wide text-carbon-300">{label}</span>
    </button>
  );
}

export default function AvatarEditor() {
  const navigate = useNavigate();
  const { avatar, setAvatar } = useUserStore();
  const [draft, setDraft] = useState<MascotLook>(avatar);
  const [tab, setTab] = useState<Tab>('cuerpo');

  const set = (patch: Partial<MascotLook>) => setDraft({ ...draft, ...patch });

  const save = () => {
    setAvatar(draft);
    navigate('/profile');
  };

  return (
    <div className="min-h-dvh bg-carbon-900 flex flex-col pt-safe pb-safe">
      <header className="shrink-0 h-[58px] border-b-2 border-carbon-800 flex items-center justify-between px-4">
        <button
          onClick={() => navigate('/profile')}
          aria-label="Descartar y volver"
          className="text-carbon-500 hover:text-carbon-200 transition p-1 -ml-1"
        >
          <Icon name="close" size={24} strokeWidth={2.4} />
        </button>
        <h2 className="text-[20px] font-black text-carbon-300">Editar avatar</h2>
        <button
          onClick={save}
          className="btn-3d h-12 px-5 rounded-xl bg-lime-500 hover:bg-lime-400 text-carbon-900 font-bold text-[16px] uppercase tracking-[0.64px]"
          style={{ ['--btn-lip' as string]: 'var(--color-lime-700)' }}
        >
          Guardar
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 lg:flex lg:gap-6 lg:items-start">
          {/* Preview */}
          <div className="lg:w-[300px] shrink-0 bg-carbon-850 border-2 border-carbon-800 rounded-3xl flex items-center justify-center py-8">
            <Mascot size={170} mood="happy" look={draft} />
          </div>

          <div className="flex-1 min-w-0 mt-5 lg:mt-0">
            {/* Tabs */}
            <div className="flex border-b-2 border-carbon-800">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 border-b-[3px] -mb-[2px] transition ${
                    tab === t.id
                      ? 'border-lime-400 text-lime-400'
                      : 'border-transparent text-carbon-500 hover:text-carbon-300'
                  }`}
                >
                  <Icon name={t.icon} size={22} />
                  <span className="text-[10px] font-black uppercase tracking-wide">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="pt-5">
              {tab === 'cuerpo' && (
                <>
                  <h3 className="text-[19px] font-black text-carbon-50 mb-3">Color del toro</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                    {BODY_COLORS.map((c) => (
                      <Swatch key={c} color={c} active={draft.body === c} onClick={() => set({ body: c })} />
                    ))}
                  </div>
                </>
              )}

              {tab === 'antifaz' && (
                <>
                  <h3 className="text-[19px] font-black text-carbon-50 mb-3">Color del antifaz</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {MASK_COLORS.map((c) => (
                      <Swatch key={c} color={c} active={draft.mask === c} onClick={() => set({ mask: c })} />
                    ))}
                  </div>
                </>
              )}

              {tab === 'cuernos' && (
                <>
                  <h3 className="text-[19px] font-black text-carbon-50 mb-3">Cuernos</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {HORN_OPTIONS.map((o) => (
                      <ShapeOption
                        key={o.id}
                        label={o.label}
                        active={draft.horns === o.id}
                        onClick={() => set({ horns: o.id })}
                      >
                        <Mascot size={64} look={{ ...draft, horns: o.id }} />
                      </ShapeOption>
                    ))}
                  </div>
                </>
              )}

              {tab === 'ojos' && (
                <>
                  <h3 className="text-[19px] font-black text-carbon-50 mb-3">Ojos</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {EYE_OPTIONS.map((o) => (
                      <ShapeOption
                        key={o.id}
                        label={o.label}
                        active={draft.eyes === o.id}
                        onClick={() => set({ eyes: o.id })}
                      >
                        <Mascot size={64} look={{ ...draft, eyes: o.id }} />
                      </ShapeOption>
                    ))}
                  </div>
                </>
              )}

              {tab === 'extras' && (
                <>
                  <h3 className="text-[19px] font-black text-carbon-50 mb-3">Accesorio</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {ACCESSORY_OPTIONS.map((o) => (
                      <ShapeOption
                        key={o.id}
                        label={o.label}
                        active={draft.accessory === o.id}
                        onClick={() => set({ accessory: o.id })}
                      >
                        <Mascot size={60} look={{ ...draft, accessory: o.id }} />
                      </ShapeOption>
                    ))}
                  </div>

                  {draft.accessory !== 'ninguno' && (
                    <>
                      <h3 className="text-[19px] font-black text-carbon-50 mt-6 mb-3">Color del accesorio</h3>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {ACCESSORY_COLORS.map((c) => (
                          <Swatch
                            key={c}
                            color={c}
                            active={draft.accessoryColor === c}
                            onClick={() => set({ accessoryColor: c })}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              <button
                onClick={() => setDraft(DEFAULT_LOOK)}
                className="mt-6 text-xs font-bold text-carbon-500 hover:text-carbon-300 transition"
              >
                Restaurar el aspecto original
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
