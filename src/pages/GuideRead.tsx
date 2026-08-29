import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { SKILL_TREE } from '../data/lessons';
import { buildStage } from '../utils/buildActivityStream';
import { useUserStore } from '../store/useUserStore';

/**
 * The whole topic, explained in order — the read-it path next to Guide's
 * quiz-it one (Repasar). Repasar only asks about terms already unlocked, on
 * purpose: it's testing what you know. This is the opposite kind of thing,
 * so it covers every teaching stage regardless of progress, the same way a
 * textbook chapter doesn't wait for you to have started the course.
 */
export default function GuideRead() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const nodeId = params.get('tema');
  const getNodeMaxStage = useUserStore((s) => s.getNodeMaxStage);

  const node = useMemo(() => SKILL_TREE.find((n) => n.id === nodeId), [nodeId]);
  const maxStage = node ? getNodeMaxStage(node.id) : 0;
  const teachingStages = Math.max(1, maxStage - 1);

  const steps = useMemo(() => {
    if (!node) return [];
    return Array.from({ length: teachingStages }, (_, stage) => buildStage(node, [], stage, maxStage)).filter(
      (plan) => plan.explanation.trim().length > 0
    );
  }, [node, maxStage, teachingStages]);

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!nodeId || !node || steps.length === 0) navigate('/guia', { replace: true });
  }, [nodeId, node, steps.length, navigate]);

  if (!node || steps.length === 0) return null;
  const plan = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-dvh bg-carbon-900 flex flex-col">
      <TopBar />

      <div className="flex-1 px-4 pb-32">
        <div className="max-w-xl mx-auto py-6">
          <button
            onClick={() => navigate('/guia')}
            className="flex items-center gap-1 text-sm font-black text-carbon-400 hover:text-carbon-200 transition"
          >
            <Icon name="chevron-left" size={18} /> Guía
          </button>

          <div className="mt-4 flex items-center gap-2">
            <Icon name={node.icon} size={22} className="text-lime-500" />
            <h1 className="text-xl font-black text-carbon-50">{node.title}</h1>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-carbon-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-lime-500 transition-all duration-300"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-[13px] font-black text-carbon-500 tabular-nums">
              {step + 1}/{steps.length}
            </span>
          </div>

          <div key={step} className="mt-6 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-5 animate-pop-in">
            <p className="text-[13px] font-black uppercase tracking-[0.8px] text-lime-400">
              Paso {step + 1}
            </p>
            <h2 className="mt-1 text-lg font-black text-carbon-50">{plan.title}</h2>
            <p className="mt-3 text-[15px] text-carbon-300 leading-relaxed">{plan.explanation}</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-carbon-900 border-t-2 border-carbon-800 pb-safe">
        <div className="max-w-xl mx-auto px-4 py-4 flex gap-3">
          {step > 0 && (
            <Button variant="secondary" fullWidth={false} onClick={() => setStep((s) => s - 1)}>
              Anterior
            </Button>
          )}
          <div className="flex-1">
            <Button onClick={() => (isLast ? navigate('/guia') : setStep((s) => s + 1))}>
              {isLast ? 'Terminar' : 'Siguiente'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
