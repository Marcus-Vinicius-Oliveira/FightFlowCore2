// Cor visual por modalidade — usada no perfil do aluno e na grade semanal.
// Modalidades conhecidas têm cor fixa (identidade estável entre telas);
// as demais recebem uma cor determinística derivada do id.

export const MODALITY_COLOR_PALETTE = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#a855f7',
];

export const KNOWN_MODALITY_COLORS: Record<string, string> = {
  'bjj': '#3b82f6', 'jiu-jitsu': '#3b82f6', 'jiu jitsu': '#3b82f6',
  'muay thai': '#ef4444', 'muay-thai': '#ef4444', 'muaythai': '#ef4444',
  'judô': '#f97316', 'judo': '#f97316', 'judô brasileiro': '#f97316',
};

export function hashModalityColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return MODALITY_COLOR_PALETTE[Math.abs(h) % MODALITY_COLOR_PALETTE.length];
}

export function getModalityColor(classTypeId: string, name: string): string {
  return KNOWN_MODALITY_COLORS[name.toLowerCase().trim()] ?? hashModalityColor(classTypeId);
}
