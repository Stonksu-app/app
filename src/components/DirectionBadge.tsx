import Icon from './Icon';

export default function DirectionBadge({ direction }: { direction: 'long' | 'short' }) {
  const isLong = direction === 'long';
  return (
    <div
      className={`absolute left-1/2 top-0 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap animate-direction-pop ${
        isLong ? 'bg-lime-500 text-carbon-900' : 'bg-danger-500 text-white'
      }`}
      aria-hidden="true"
    >
      <Icon name={isLong ? 'trending-up' : 'trending-down'} size={13} strokeWidth={2.5} />
      {isLong ? 'LONG' : 'SHORT'}
    </div>
  );
}
