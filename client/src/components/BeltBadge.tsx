interface BeltStyle {
  badge: string;
  dot: string;
}

const BELT_STYLES: Record<string, BeltStyle> = {
  branca:   { badge: 'bg-white border border-gray-300 text-gray-600 shadow-sm',    dot: 'bg-gray-300' },
  cinza:    { badge: 'bg-slate-500 text-white',                                     dot: 'bg-slate-200' },
  amarela:  { badge: 'bg-yellow-400 text-yellow-900',                               dot: 'bg-yellow-700' },
  laranja:  { badge: 'bg-orange-500 text-white',                                    dot: 'bg-orange-200' },
  verde:    { badge: 'bg-green-700 text-white',                                     dot: 'bg-green-300' },
  azul:     { badge: 'bg-blue-600 text-white',                                      dot: 'bg-blue-200' },
  roxa:     { badge: 'bg-purple-700 text-white',                                    dot: 'bg-purple-300' },
  marrom:   { badge: 'bg-amber-800 text-white',                                     dot: 'bg-amber-400' },
  preta:    { badge: 'bg-gray-900 text-white border border-gray-700',               dot: 'bg-gray-500' },
  vermelha: { badge: 'bg-red-600 text-white',                                       dot: 'bg-red-200' },
  coral:    { badge: 'bg-rose-500 text-white',                                      dot: 'bg-rose-200' },
};

const FALLBACK: BeltStyle = {
  badge: 'bg-gray-100 border border-gray-200 text-gray-500',
  dot: 'bg-gray-400',
};

interface BeltBadgeProps {
  belt?: string | null;
  className?: string;
}

export function BeltBadge({ belt, className = '' }: BeltBadgeProps) {
  if (!belt?.trim()) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const key = belt.trim().toLowerCase();
  const style = BELT_STYLES[key] ?? FALLBACK;
  const label = key;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none',
        style.badge,
        className,
      ].join(' ')}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      {label}
    </span>
  );
}
