import { describe, it, expect } from "vitest";
import { normalizePhoneBR, waLink, whatsappReminderText, whatsappChargeText } from "@shared/whatsapp";
import { buildTemplatePayload } from "../lib/whatsapp";

describe("normalizePhoneBR", () => {
  it("aceita os formatos comuns de celular BR", () => {
    expect(normalizePhoneBR("(11) 98888-7777")).toBe("5511988887777");
    expect(normalizePhoneBR("11988887777")).toBe("5511988887777");
    expect(normalizePhoneBR("5511988887777")).toBe("5511988887777");
    expect(normalizePhoneBR("+55 11 98888-7777")).toBe("5511988887777");
  });

  it("aceita fixo com DDD (10 dígitos)", () => {
    expect(normalizePhoneBR("(11) 3333-4444")).toBe("551133334444");
  });

  it("descarta zeros de tronco à esquerda", () => {
    expect(normalizePhoneBR("011 98888-7777")).toBe("5511988887777");
  });

  it("rejeita telefones curtos, vazios ou ausentes", () => {
    expect(normalizePhoneBR("9888-7777")).toBeNull();  // sem DDD
    expect(normalizePhoneBR("")).toBeNull();
    expect(normalizePhoneBR(null)).toBeNull();
    expect(normalizePhoneBR(undefined)).toBeNull();
  });
});

describe("waLink", () => {
  it("monta o link click-to-chat com a mensagem URL-encoded", () => {
    const link = waLink("(11) 98888-7777", "Olá, João!");
    expect(link).toBe("https://wa.me/5511988887777?text=Ol%C3%A1%2C%20Jo%C3%A3o!");
  });

  it("devolve null para telefone inválido", () => {
    expect(waLink("123", "oi")).toBeNull();
    expect(waLink(null, "oi")).toBeNull();
  });
});

describe("textos de mensagem", () => {
  it("lembrete cita plano, academia, valor e data", () => {
    const text = whatsappReminderText({
      studentName: "João", planName: "BJJ Mensal", academyName: "Anjo",
      valor: "R$ 150,00", data: "05/08/2026",
    });
    expect(text).toContain("João");
    expect(text).toContain("BJJ Mensal");
    expect(text).toContain("R$ 150,00");
    expect(text).toContain("05/08/2026");
  });

  it("cobrança no singular menciona a data de vencimento", () => {
    const text = whatsappChargeText({
      studentName: "João", academyName: "Anjo", valor: "R$ 150,00", count: 1, data: "05/07/2026",
    });
    expect(text).toContain("uma mensalidade em aberto");
    expect(text).toContain("vencida em 05/07/2026");
  });

  it("cobrança no plural agrega o total sem data", () => {
    const text = whatsappChargeText({
      studentName: "Amanda", academyName: "Anjo", valor: "R$ 270,00", count: 2,
    });
    expect(text).toContain("constam 2 mensalidades em aberto");
    expect(text).toContain("R$ 270,00");
    expect(text).not.toContain("vencida em");
  });
});

describe("buildTemplatePayload", () => {
  it("monta o payload da Cloud API com parâmetros posicionais em pt_BR", () => {
    const payload = buildTemplatePayload("5511988887777", "lembrete_mensalidade", ["João", "BJJ", "Anjo", "R$ 150,00", "05/08/2026"]);
    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "5511988887777",
      type: "template",
      template: {
        name: "lembrete_mensalidade",
        language: { code: "pt_BR" },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: "João" },
            { type: "text", text: "BJJ" },
            { type: "text", text: "Anjo" },
            { type: "text", text: "R$ 150,00" },
            { type: "text", text: "05/08/2026" },
          ],
        }],
      },
    });
  });
});
