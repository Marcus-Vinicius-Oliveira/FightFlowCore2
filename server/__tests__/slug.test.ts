import { describe, it, expect } from "vitest";
import { slugify, nextAvailableSlug } from "../lib/slug";

describe("slugify", () => {
  it("normaliza nome para minúsculas com hífens", () => {
    expect(slugify("Academia Impacto")).toBe("academia-impacto");
    expect(slugify("Fight  Club!! App")).toBe("fight-club-app");
  });

  it("remove acentos em vez de virar hífen", () => {
    expect(slugify("Judô & Cia")).toBe("judo-cia");
    expect(slugify("Associação São João")).toBe("associacao-sao-joao");
  });

  it("descarta hífens nas bordas e repetidos", () => {
    expect(slugify("--Anjo--")).toBe("anjo");
  });

  it("nome sem caracteres úteis cai no fallback", () => {
    expect(slugify("!!!")).toBe("academia");
    expect(slugify("")).toBe("academia");
  });
});

describe("nextAvailableSlug", () => {
  const takenSet = (...slugs: string[]) => {
    const set = new Set(slugs);
    return async (s: string) => set.has(s);
  };

  it("devolve a base quando está livre", async () => {
    expect(await nextAvailableSlug("anjo", takenSet())).toBe("anjo");
  });

  it("sufixa incrementalmente a partir de -2", async () => {
    expect(await nextAvailableSlug("anjo", takenSet("anjo"))).toBe("anjo-2");
    expect(await nextAvailableSlug("anjo", takenSet("anjo", "anjo-2", "anjo-3"))).toBe("anjo-4");
  });

  it("não é enganado por buracos na sequência", async () => {
    expect(await nextAvailableSlug("anjo", takenSet("anjo", "anjo-3"))).toBe("anjo-2");
  });
});
