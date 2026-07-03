// Envio de e-mail via SMTP configurável por variáveis de ambiente (ver .env.example).
// Sem SMTP_HOST configurado, opera em modo log — nenhum e-mail real é enviado.

import nodemailer, { type Transporter } from 'nodemailer';
import { log } from '../vite';

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!isMailerConfigured()) {
    log(`[mailer] SMTP não configurado — e-mail apenas registrado: "${message.subject}" → ${message.to}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    ...message,
  });
}
