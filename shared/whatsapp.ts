/**
 * Helpers puros de WhatsApp compartilhados entre client e server:
 * normalização de telefone brasileiro, link wa.me (click-to-chat) e os
 * textos padrão de lembrete (pré-vencimento) e cobrança (vencida).
 *
 * Valor e data chegam já formatados (strings): cada lado tem sua própria
 * convenção de formatação — no client datas date-only são exibidas em UTC
 * (client/src/lib/dates.ts) e no server em local — e o texto não deve
 * reintroduzir a divergência de fuso.
 */

/**
 * Normaliza um telefone BR para o formato aceito por wa.me e pela Cloud API:
 * só dígitos, com DDI 55. Aceita "(11) 98888-7777", "11988887777",
 * "5511988887777", "+55 11 98888-7777". Retorna null se não parecer um
 * telefone BR válido (menos de DDD + 8 dígitos).
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  // Já com DDI 55: fixo (12 dígitos) ou celular com 9 (13 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  // DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

/** Link click-to-chat com mensagem pré-preenchida; null se o telefone for inválido. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const normalized = normalizePhoneBR(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export interface WhatsappReminderInput {
  studentName: string;
  planName: string;
  academyName: string;
  /** Valor já formatado (ex: "R$ 150,00") */
  valor: string;
  /** Data de vencimento já formatada (ex: "05/08/2026") */
  data: string;
}

/** Lembrete pré-vencimento (D-N) — mesmo tom do e-mail. */
export function whatsappReminderText(input: WhatsappReminderInput): string {
  return [
    `Olá, ${input.studentName}! 👋`,
    '',
    `Lembrete: sua mensalidade do plano ${input.planName} na ${input.academyName}, no valor de ${input.valor}, vence em ${input.data}.`,
    '',
    'Se o pagamento já foi realizado, por favor desconsidere esta mensagem.',
    '',
    'Bons treinos! 🥋',
  ].join('\n');
}

export interface WhatsappChargeInput {
  studentName: string;
  academyName: string;
  /** Total devido já formatado (ex: "R$ 270,00") */
  valor: string;
  /** Quantidade de mensalidades em aberto (1 = cobrança simples) */
  count: number;
  /** Vencimento formatado — informado quando é uma única mensalidade */
  data?: string;
}

/** Cobrança de mensalidade(s) vencida(s) — tom cordial, usada nos botões manuais. */
export function whatsappChargeText(input: WhatsappChargeInput): string {
  const pendencia = input.count > 1
    ? `constam ${input.count} mensalidades em aberto na ${input.academyName}, totalizando ${input.valor}`
    : `consta uma mensalidade em aberto na ${input.academyName}, no valor de ${input.valor}${input.data ? `, vencida em ${input.data}` : ''}`;
  return [
    `Olá, ${input.studentName}! Tudo bem? 👋`,
    '',
    `Passando para avisar que ${pendencia}.`,
    '',
    'Se o pagamento já foi realizado, por favor desconsidere esta mensagem. Qualquer dúvida, estamos à disposição! 🙏',
  ].join('\n');
}
