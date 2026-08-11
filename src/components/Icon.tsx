import type { IconName } from '../types';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 24, className = '', strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  bull: (
    <>
      <path d="M5 6c-1.5-1-3-.5-3 1s1.5 2.5 3 2" />
      <path d="M19 6c1.5-1 3-.5 3 1s-1.5 2.5-3 2" />
      <path d="M6 10c0-3 2.7-5 6-5s6 2 6 5v2.5c0 3.6-2.7 6.5-6 6.5s-6-2.9-6-6.5V10z" />
      <path d="M9 12.5c0 1 .7 1.5 1.2 1.5" />
      <path d="M15 12.5c0 1-.7 1.5-1.2 1.5" />
      <circle cx="9.7" cy="10.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="10.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10.5 16.2c.5.4 1.5.4 2 0" />
    </>
  ),
  map: (
    <>
      <path d="M2 6.5 8 4l8 2.5 6-2.5v15l-6 2.5-8-2.5-6 2.5v-15z" />
      <path d="M8 4v15" />
      <path d="M16 6.5V21" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" />
    </>
  ),
  flame: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2.5
         C9 6 6 9 6 13.5
         C6 17.6 8.9 21 12.5 21
         C16.3 21 18.5 17.9 18.5 14
         C18.5 10.8 17 8.5 15.3 7
         C15.6 9.1 14.8 10.6 13.5 11.1
         C14.1 7.9 13.2 5 12 2.5
         Z"
    />
  ),
  star: (
    <path d="M12 2.5 14.7 8.6 21.3 9.3 16.4 13.8 17.8 20.4 12 17 6.2 20.4 7.6 13.8 2.7 9.3 9.3 8.6 12 2.5Z" />
  ),
  heart: (
    <path d="M12 20.2s-7.5-4.4-10-9.2C.5 7.8 2.4 4.5 5.7 4c2-.3 3.8.6 6.3 3.1C14.5 4.6 16.3 3.7 18.3 4c3.3.5 5.2 3.8 3.7 7-2.5 4.8-10 9.2-10 9.2Z" />
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </>
  ),
  close: (
    <>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </>
  ),
  check: <path d="M4 12.5 9.5 18 20 6" />,
  book: (
    <>
      <path d="M12 5.5c-1.8-1.3-4.6-2-8-2v13.5c3.4 0 6.2.7 8 2 1.8-1.3 4.6-2 8-2V3.5c-3.4 0-6.2.7-8 2Z" />
      <path d="M12 5.5v13.5" />
    </>
  ),
  candle: (
    <>
      <rect x="9" y="9" width="6" height="9" rx="1" />
      <path d="M12 3.5v5.5" />
      <path d="M12 18v2.5" />
    </>
  ),
  ruler: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="1.5" />
      <path d="M7 7v3" />
      <path d="M11 7v3" />
      <path d="M15 7v3" />
      <path d="M19 7v3" />
    </>
  ),
  'trending-down': (
    <>
      <path d="M3 7l7 7 4-4 7 8" />
      <path d="M21 13.5V18h-4.5" />
    </>
  ),
  'trending-up': (
    <>
      <path d="M3 17l7-7 4 4 7-8" />
      <path d="M21 10.5V6h-4.5" />
    </>
  ),
  shield: <path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6l8-3.5Z" />,
  brain: (
    <>
      <path d="M9.5 4.5a3 3 0 0 0-3 3v.3A3 3 0 0 0 4.8 12a3 3 0 0 0 1.2 5.7 3 3 0 0 0 3 2.8h2V4.5h-1.5Z" />
      <path d="M14.5 4.5a3 3 0 0 1 3 3v.3A3 3 0 0 1 19.2 12a3 3 0 0 1-1.2 5.7 3 3 0 0 1-3 2.8h-2V4.5h1.5Z" />
      <path d="M12 8v10.5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14.5h7" />
      <path d="M8.5 18h4.5" />
    </>
  ),
  newspaper: (
    <>
      <rect x="3" y="5.5" width="14" height="14" rx="1.5" />
      <path d="M17 9h4v8.5a1.5 1.5 0 0 1-1.5 1.5H17" />
      <path d="M6 9h5" />
      <path d="M6 12h8" />
      <path d="M6 15h8" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4.5h10v5a5 5 0 0 1-10 0v-5Z" />
      <path d="M7 6H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
      <path d="M17 6h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
      <path d="M12 14.5V17" />
      <path d="M8.5 20.5h7" />
      <path d="M9.5 17.5h5l.5 3h-6l.5-3Z" />
    </>
  ),
  diamond: (
    <>
      <path d="M6 3.5h12l4 6-10 11-10-11 4-6Z" />
      <path d="M2 9.5h20" />
      <path d="M9 3.5 12 9.5l-2.5 11" />
      <path d="M15 3.5 12 9.5l2.5 11" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="6" />
      <path d="M9.5 3 6 10.5" />
      <path d="M14.5 3 18 10.5" />
      <path d="M9.5 3h5l-1.6 4.5h-1.8L9.5 3Z" />
      <path d="M12 12.5v5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z" />
      <path d="M15.5 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
      <path d="M4 9.5h16" />
    </>
  ),
  egg: <path d="M12 21c4 0 6.5-3.4 6.5-8.2C18.5 7.7 15.5 3 12 3s-6.5 4.7-6.5 9.8C5.5 17.6 8 21 12 21Z" />,
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c-4 0-7-2.5-7-7 4.5 0 7 2 7 5" />
      <path d="M12 12c4 0 7-2.5 7-7-4.5 0-7 2-7 5" />
    </>
  ),
  whale: (
    <>
      <path d="M2.5 13c1-3.5 4.5-6 9-6 5.5 0 9.5 3.3 10.7 5.2.5.8-.1 1.8-1 1.8H6c-1.5 0-3-.4-3.5-1z" />
      <path d="M18 8.5V6" />
      <path d="M8 13v2.5" />
      <path d="M11.5 13v3" />
      <circle cx="9" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="8" rx="6" ry="3.5" />
      <path d="M3 8v4c0 1.9 2.7 3.5 6 3.5s6-1.6 6-3.5V8" />
      <path d="M3 12v4c0 1.9 2.7 3.5 6 3.5 2.4 0 4.5-.8 5.5-2" />
      <ellipse cx="17" cy="14.5" rx="4" ry="2.3" />
    </>
  ),
  gamepad: (
    <>
      <path d="M6.5 7.5h11a4.5 4.5 0 0 1 4.4 5.4l-.6 3a3 3 0 0 1-5.3 1.3L14.5 15h-5l-1.5 2.2a3 3 0 0 1-5.3-1.3l-.6-3a4.5 4.5 0 0 1 4.4-5.4Z" />
      <path d="M7 11v2.5" />
      <path d="M5.7 12.2h2.6" />
      <circle cx="16" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  pillar: (
    <>
      <path d="M4 3.5h16" />
      <path d="M4 20.5h16" />
      <path d="M6 6.5h12" />
      <path d="M6 17.5h12" />
      <path d="M8 6.5v11" />
      <path d="M16 6.5v11" />
    </>
  ),
  refresh: (
    <>
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 12.3 8l4.2 1.3-4.2 1.3L11 15l-1.3-4.4L5.5 9.3l4.2-1.3L11 3.5Z" />
      <path d="M18 13l.8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5Z" />
    </>
  ),
  cards: (
    <>
      <rect x="7" y="3.5" width="11" height="15" rx="2" transform="rotate(8 12.5 11)" />
      <rect x="5.5" y="5.5" width="13" height="15" rx="2" />
      <path d="M9 13h6" />
      <path d="M9 16.5h6" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3 6h3.5c1.8 0 3.4 1 4.3 2.6" />
      <path d="M3 18h3.5c1.8 0 3.4-1 4.3-2.6" />
      <path d="M14 6h7" />
      <path d="M14 18h7" />
      <path d="M18 3l3 3-3 3" />
      <path d="M18 15l3 3-3 3" />
      <path d="M12.5 12L14 14" />
    </>
  ),
  'chevron-up': <path d="M5 15l7-7 7 7" />,
  'chevron-down': <path d="M5 9l7 7 7-7" />,
  pencil: (
    <>
      <path d="M4 20.5 4.8 16.6 15.5 5.9a1.5 1.5 0 0 1 2.1 0l1.5 1.5a1.5 1.5 0 0 1 0 2.1L8.4 19.7 4 20.5Z" />
      <path d="M14 7.5 16.5 10" />
    </>
  ),
};
