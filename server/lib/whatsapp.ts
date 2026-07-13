// Envio de WhatsApp via Cloud API oficial da Meta, configurável por variáveis
// de ambiente (ver .env.example) — mesmo desenho do mailer: sem credenciais,
// opera em modo log e nenhuma mensagem real é enviada.
//
// Mensagens iniciadas pelo negócio fora da janela de 24h exigem um template
// pré-aprovado no WhatsApp Manager — por isso o envio é por template + params,
// nunca texto livre.

import { log } from '../vite';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export interface WhatsAppTemplateMessage {
  /** Destinatário já normalizado (só dígitos, com DDI — ver normalizePhoneBR) */
  to: string;
  /** Parâmetros posicionais do corpo do template, na ordem aprovada no Meta */
  params: string[];
  /** Texto equivalente, usado apenas no modo log para o log ser legível */
  fallbackText: string;
}

/** Monta o payload da Cloud API — puro, testável sem env. */
export function buildTemplatePayload(to: string, templateName: string, params: string[]) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: params.map(text => ({ type: 'text', text })),
        },
      ],
    },
  };
}

export async function sendWhatsAppTemplate(message: WhatsAppTemplateMessage): Promise<void> {
  if (!isWhatsAppConfigured()) {
    log(`[whatsapp] Cloud API não configurada — mensagem apenas registrada → ${message.to}: "${message.fallbackText.split('\n')[0]}..."`);
    return;
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'lembrete_mensalidade';
  const res = await fetch(`${GRAPH_API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildTemplatePayload(message.to, templateName, message.params)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WhatsApp Cloud API ${res.status}: ${body}`);
  }
}
