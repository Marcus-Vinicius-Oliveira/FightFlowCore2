// Mapping from legacy belt name strings to hex colors
export const BELT_HEX: Record<string, string> = {
  branca:   '#f9fafb',
  cinza:    '#6b7280',
  amarela:  '#facc15',
  laranja:  '#f97316',
  verde:    '#15803d',
  azul:     '#2563eb',
  roxa:     '#7c3aed',
  marrom:   '#92400e',
  preta:    '#111827',
  vermelha: '#dc2626',
  coral:    '#f43f5e',
};

// Returns true for colors that need a border to be visible on white backgrounds
export function isLightHex(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
}

interface BeltBarProps {
  // hex "#2563eb" for single color, "#2563eb|#f9fafb" for bicolor
  color: string;
  name: string;
  width?: number;
  height?: number;
  className?: string;
}

// Visual horizontal belt bar. No text shown; name appears as tooltip.
export function BeltBar({ color, name, width = 52, height = 14, className = '' }: BeltBarProps) {
  const parts = color.split('|');
  const c1 = parts[0] ?? '#6b7280';
  const c2 = parts[1];
  const needsBorder = isLightHex(c1) || (c2 ? isLightHex(c2) : false);

  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 rounded-sm overflow-hidden ${className}`}
      style={{
        width,
        height,
        border: needsBorder ? '1px solid #d1d5db' : '1px solid transparent',
        boxSizing: 'content-box',
      }}
    >
      <span style={{ flex: 1, backgroundColor: c1 }} />
      {c2 && <span style={{ flex: 1, backgroundColor: c2 }} />}
    </span>
  );
}

interface BeltBadgeProps {
  belt?: string | null;
  className?: string;
}

// Legacy belt badge — accepts belt name string ("amarela", "azul", etc.)
export function BeltBadge({ belt, className = '' }: BeltBadgeProps) {
  if (!belt?.trim()) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  const key = belt.trim().toLowerCase();
  const hex = BELT_HEX[key] ?? '#6b7280';
  return <BeltBar color={hex} name={key} width={52} height={14} className={className} />;
}
