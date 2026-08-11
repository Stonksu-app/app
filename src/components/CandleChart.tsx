interface CandleProps {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  width?: number;
}

function Candle({ x, open, close, high, low, width = 20 }: CandleProps) {
  const isBullish = close < open; // svg y grows downward, lower y = higher price
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const color = isBullish ? '#C6FF34' : '#FF5252';
  return (
    <g>
      <line x1={x} x2={x} y1={high} y2={low} stroke={color} strokeWidth={2} />
      <rect
        x={x - width / 2}
        y={bodyTop}
        width={width}
        height={Math.max(bodyBottom - bodyTop, 2)}
        fill={color}
        rx={2}
      />
    </g>
  );
}

type ChartKind = 'bullish-candle' | 'bearish-candle' | 'hammer' | 'doji' | 'engulfing' | 'uptrend' | 'support-resistance';

export default function CandleChart({ kind }: { kind: ChartKind }) {
  const bg = (
    <rect x={0} y={0} width={280} height={160} fill="#0a0a0a" rx={12} />
  );

  if (kind === 'bullish-candle') {
    return (
      <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
        {bg}
        <Candle x={140} open={110} close={50} high={35} low={125} width={36} />
      </svg>
    );
  }

  if (kind === 'bearish-candle') {
    return (
      <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
        {bg}
        <Candle x={140} open={50} close={110} high={35} low={125} width={36} />
      </svg>
    );
  }

  if (kind === 'hammer') {
    return (
      <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
        {bg}
        <Candle x={80} open={70} close={80} high={65} low={100} width={16} />
        <Candle x={140} open={65} close={75} high={60} low={95} width={16} />
        <Candle x={200} open={68} close={58} high={54} low={135} width={22} />
      </svg>
    );
  }

  if (kind === 'doji') {
    return (
      <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
        {bg}
        <Candle x={100} open={60} close={90} high={45} low={105} width={16} />
        <Candle x={140} open={79} close={81} high={40} low={130} width={30} />
        <Candle x={180} open={90} close={60} high={45} low={105} width={16} />
      </svg>
    );
  }

  if (kind === 'engulfing') {
    return (
      <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
        {bg}
        <Candle x={110} open={70} close={90} high={65} low={95} width={18} />
        <Candle x={160} open={95} close={55} high={48} low={102} width={34} />
      </svg>
    );
  }

  if (kind === 'uptrend') {
    return (
      <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
        {bg}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 40 + i * 38;
          const base = 135 - i * 15;
          const open = base;
          const close = base - 12;
          return <Candle key={i} x={x} open={open} close={close} high={close - 8} low={open + 8} width={16} />;
        })}
      </svg>
    );
  }

  // support-resistance
  return (
    <svg viewBox="0 0 280 160" className="w-full max-w-xs mx-auto rounded-xl">
      {bg}
      <line x1={20} x2={260} y1={40} y2={40} stroke="#FF5252" strokeDasharray="6 4" strokeWidth={2} />
      <line x1={20} x2={260} y1={120} y2={120} stroke="#C6FF34" strokeDasharray="6 4" strokeWidth={2} />
      {[
        { x: 40, open: 100, close: 60 },
        { x: 75, open: 60, close: 45 },
        { x: 110, open: 45, close: 90 },
        { x: 145, open: 90, close: 115 },
        { x: 180, open: 115, close: 50 },
        { x: 215, open: 50, close: 42 },
        { x: 250, open: 42, close: 80 },
      ].map((c, i) => (
        <Candle key={i} x={c.x} open={c.open} close={c.close} high={Math.min(c.open, c.close) - 6} low={Math.max(c.open, c.close) + 6} width={14} />
      ))}
    </svg>
  );
}
