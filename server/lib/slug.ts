// Slug público da academia (URLs do portal e do QR de check-in) — legível por
// design; unicidade vem do sufixo incremental, não de aleatoriedade. O ID real
// (academies.id) é UUID e nunca depende disto.

/** "Academia Impacto!" → "academia-impacto". Nome sem nenhum caractere útil cai no fallback. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')           // remove acentos (Impacto → impacto, Judô → judo)
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'academia';
}

/**
 * Primeiro slug livre da família: base, base-2, base-3... — o cadastro nunca
 * falha por nome repetido (padrão GitHub/Slack). O unique do banco continua
 * como guarda final contra corrida.
 */
export async function nextAvailableSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
}
