import { describe, expect, it } from "vitest";
import { AGREEMENT_BN, LEGAL_BN } from "@/lib/legal/bn";
import { AGREEMENT_EN, LEGAL_EN } from "@/lib/legal/en";
import { agreementToText, docToText, textToAgreement, textToDoc, usedPlaceholders } from "@/lib/legal/format";
import { LEGAL_PLACEHOLDERS } from "@/lib/legal/placeholders";

describe("legal text format (A-16)", () => {
  it("every built-in page survives text and back, in both languages", () => {
    for (const docs of [LEGAL_EN, LEGAL_BN]) {
      for (const doc of Object.values(docs)) {
        const back = textToDoc(docToText(doc));
        expect(back.ok).toBe(true);
        if (back.ok) expect(back.doc).toEqual(doc);
      }
    }
  });

  it("the built-in agreements survive text and back", () => {
    for (const a of [AGREEMENT_EN, AGREEMENT_BN]) {
      const back = textToAgreement(agreementToText(a));
      expect(back.ok && back.agreement).toEqual(a);
    }
  });

  it("joins wrapped lines, continues list items and gives headings without an anchor their own", () => {
    const res = textToDoc("# T\n> D\n\n- point\n\n## One\nline a\nline b\n\n- item\n  more\n- two\n\n## Two {#two}\nx");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.summary).toEqual(["point"]);
    expect(res.doc.sections[0]).toEqual({ id: "s1", heading: "One", blocks: ["line a line b", { list: ["item more", "two"] }] });
    expect(res.doc.sections[1].id).toBe("two");
  });

  it("explains what is wrong", () => {
    expect(textToDoc("no title")).toEqual({ ok: false, problem: "noTitle" });
    expect(textToDoc("# T\n> D")).toEqual({ ok: false, problem: "noSections" });
    expect(textToDoc("# T\nloose text\n## A\nx")).toEqual({ ok: false, problem: "textOutsideSection" });
    expect(textToDoc("# T\n## A\n## B\nx")).toEqual({ ok: false, problem: "emptySection" });
    expect(textToDoc("# T\n## A {#Bad Id}\nx")).toEqual({ ok: false, problem: "badAnchor" });
    expect(textToDoc("# T\n## A {#a}\nx\n## B {#a}\ny")).toEqual({ ok: false, problem: "sameAnchor" });
    expect(textToAgreement("# T\njust text")).toEqual({ ok: false, problem: "noClauses" });
    expect(textToDoc("# T\n## A\n" + "x".repeat(100_001))).toEqual({ ok: false, problem: "tooLong" });
  });

  it("knows the placeholders the built-in texts use", () => {
    expect(LEGAL_PLACEHOLDERS).toEqual(expect.arrayContaining(["claimDays", "judging", "phone"]));
    expect(usedPlaceholders("## A {#anchor}\n{fee} and {fee}")).toEqual(["fee"]);
  });
});
