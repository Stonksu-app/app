import { Link } from 'react-router-dom';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import type { IconName } from '../types';

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'candle', title: 'Lee las velas', desc: 'Domina candlesticks sin morir en el intento' },
  { icon: 'shield', title: 'Gestiona el riesgo', desc: 'Stop loss, take profit y no todo el YOLO' },
  { icon: 'flame', title: 'Mantén tu racha', desc: 'Aprende un poco cada día, como debe ser' },
  { icon: 'trophy', title: 'Compite en ligas', desc: 'De Paper Hands a Diamond Hands' },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-carbon-900">
      <header className="max-w-5xl mx-auto flex items-center justify-between px-5 py-5">
        <Mascot size={40} mood="happy" />
        <Link
          to="/onboarding"
          className="text-sm font-bold text-lime-400 hover:text-lime-300 px-4 py-2 rounded-full border-2 border-carbon-700 hover:border-lime-500/50 transition"
        >
          Ya tengo cuenta
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-5 pt-8 pb-20 text-center">
        <div className="flex justify-center mb-4">
          <Mascot size={140} mood="hype" />
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-carbon-50 leading-tight tracking-tight">
          Aprende a invertir<br />
          <span className="text-lime-400">gratis, gamificado y sin rekt.</span>
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-carbon-300 max-w-2xl mx-auto font-medium">
          La forma más divertida (y menos aburrida) de aprender trading e inversión.
          Lecciones cortas, XP, rachas y un toro motivacional.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/onboarding"
            className="w-full sm:w-auto bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black text-lg px-10 py-4 rounded-2xl shadow-lg shadow-lime-500/20 transition active:scale-95"
          >
            Empezar gratis
          </Link>
        </div>
        <p className="mt-3 text-sm text-carbon-400">Sin tarjeta. Sin excusas. Solo diamond hands.</p>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-carbon-850 rounded-2xl p-5 border border-carbon-800 hover:border-lime-500/30 transition"
            >
              <Icon name={f.icon} size={28} className="text-lime-500 mb-2" />
              <h3 className="font-extrabold text-carbon-50">{f.title}</h3>
              <p className="text-sm text-carbon-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 bg-carbon-850 border border-carbon-800 rounded-3xl p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-black text-carbon-50">¿Listo para dejar de ser Paper Hands?</h2>
          <p className="mt-2 text-carbon-300 max-w-xl mx-auto">
            Únete y empieza tu racha hoy. Tu portafolio (y tu ego) te lo van a agradecer.
          </p>
          <Link
            to="/onboarding"
            className="inline-block mt-6 bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black px-8 py-3.5 rounded-2xl transition active:scale-95"
          >
            Crear mi cuenta
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-carbon-500 pb-8">
        Stonksu no es asesoría financiera. Es un juego para aprender, fren.
      </footer>
    </div>
  );
}
