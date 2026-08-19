import Mascot from './Mascot';
import { useUserStore } from '../store/useUserStore';

/**
 * The player's own bull. Use this anywhere the mascot represents *them* —
 * lesson feedback, results, the profile. Brand surfaces (wordmark, splash,
 * landing) keep rendering <Mascot /> so a red avatar doesn't repaint the logo.
 */
export default function Avatar({
  size = 96,
  mood = 'happy',
  className = '',
  glow = false,
}: {
  size?: number;
  mood?: 'happy' | 'hype' | 'sad' | 'neutral';
  className?: string;
  /** Soft halo in the avatar's own colour. */
  glow?: boolean;
}) {
  const look = useUserStore((s) => s.avatar);

  if (!glow) return <Mascot size={size} mood={mood} className={className} look={look} />;

  return (
    <div className="relative inline-flex items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute rounded-full blur-2xl opacity-25 pointer-events-none"
        style={{ backgroundColor: look.body, width: size * 0.8, height: size * 0.8 }}
      />
      <Mascot size={size} mood={mood} className={`relative ${className}`} look={look} />
    </div>
  );
}
