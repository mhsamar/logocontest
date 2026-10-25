import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-24: the Meta Pixel base code on every page, unchanged, and four events, each once per action and only
// after it succeeded.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const SNIPPET = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1804708190768737');
fbq('track', 'PageView');`;
const NOSCRIPT = `<img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=1804708190768737&ev=PageView&noscript=1"
/>`;

describe("Meta Pixel base code", () => {
  it("sits unchanged in the root layout's head, first, on the live site only", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain(SNIPPET);
    expect(layout).toContain(NOSCRIPT);
    expect(layout).toContain('const META_PIXEL = process.env.VERCEL_ENV === "production";');
    expect(layout).toMatch(/<head>\s*\{pixel && \(/);
    expect(layout.indexOf("<head>")).toBeLessThan(layout.indexOf("<body"));
  });

  it("never runs for the team, on Admin or unsubscribe pages, or while staff use Log in as", async () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('const pixel = META_PIXEL && user?.role !== "admin" && (await headers()).get(NO_PIXEL_HEADER) !== "1" && !(user && (await viewingAs(user.id)));');
    expect(read("src/proxy.ts")).toContain("if (noPixelPath(request.nextUrl.pathname)) request.headers.set(NO_PIXEL_HEADER, \"1\");");
    const { noPixelPath } = await import("@/lib/analytics/meta-pixel");
    for (const p of ["/admin", "/admin/users", "/admin-login", "/admin-signed-out", "/email/unsubscribe"]) expect(noPixelPath(p), p).toBe(true);
    for (const p of ["/", "/start", "/contests", "/administration", "/client/contests/x", "/designers/signup"]) expect(noPixelPath(p), p).toBe(false);
    // Signed in from a public page that had the pixel: Admin reloads once without it, and resets for the next sign-in.
    const nav = read("src/components/admin/admin-nav.tsx");
    expect(nav).toContain('if (sessionStorage.getItem("lc-px-admin-reload")) return;');
    expect(nav).toContain('if (typeof window.fbq !== "function") return sessionStorage.removeItem("lc-px-admin-reload");');
  });
});

describe("Meta domain verification", () => {
  it("is in the root layout's metadata, so every page's <head> has it", () => {
    expect(read("src/app/layout.tsx")).toContain('"facebook-domain-verification": "mo7wzhn8u6wu6r14jt0kr0bf0cugg7"');
    // The Pinterest claim stays.
    expect(read("src/app/layout.tsx")).toContain('"p:domain_verify": "cb536e9e87dbc7662f94b8400e106a79"');
  });
});

describe("trackPixel", () => {
  const store = new Map<string, string>();
  const fbq = vi.fn();
  beforeEach(() => {
    store.clear();
    fbq.mockReset();
    vi.stubGlobal("window", { fbq });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends an event once per key, with the key as its event ID", async () => {
    const { trackPixel } = await import("@/lib/analytics/meta-pixel");
    trackPixel("purchase:p1", "Purchase", { value: 5000, currency: "BDT" });
    trackPixel("purchase:p1", "Purchase", { value: 5000, currency: "BDT" });
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("track", "Purchase", { value: 5000, currency: "BDT" }, { eventID: "purchase:p1" });
  });

  it("remembers it across a reload (a new page load with the same browser storage)", async () => {
    (await import("@/lib/analytics/meta-pixel")).trackPixel("register:c1", "CompleteRegistration");
    vi.resetModules();
    (await import("@/lib/analytics/meta-pixel")).trackPixel("register:c1", "CompleteRegistration");
    expect(fbq).toHaveBeenCalledTimes(1);
  });

  it("a resumed draft marks the start without sending it", async () => {
    const { markPixel, trackPixel } = await import("@/lib/analytics/meta-pixel");
    markPixel("initiate:v1");
    trackPixel("initiate:v1", "InitiateCheckout");
    expect(fbq).not.toHaveBeenCalled();
  });

  it("does nothing without the pixel (local and preview builds)", async () => {
    vi.stubGlobal("window", {});
    const { trackPixel } = await import("@/lib/analytics/meta-pixel");
    expect(() => trackPixel("lead:x", "Lead")).not.toThrow();
  });

  it("a Purchase is fresh for 48 hours after payment", async () => {
    const { freshPurchase } = await import("@/lib/analytics/meta-pixel");
    const now = new Date("2026-10-24T12:00:00Z");
    expect(freshPurchase(new Date("2026-10-23T12:00:00Z"), now)).toBe(true);
    expect(freshPurchase(new Date("2026-10-22T11:59:00Z"), now)).toBe(false);
    expect(freshPurchase(null, now)).toBe(false);
  });
});

describe("where each event fires", () => {
  it("InitiateCheckout: entering a wizard fresh; a resumed draft sends nothing and doesn't block the next start", () => {
    expect(read("src/components/wizard/wizard.tsx")).toContain('if (!props.resume) trackPixel(`initiate:${pixelStartId()}`, "InitiateCheckout");');
    expect(read("src/components/services/service-wizard.tsx")).toContain('if (!resume) trackPixel(`initiate:${pixelStartId()}`, "InitiateCheckout");');
  });

  it("CompleteRegistration: only after the client's account was created", () => {
    for (const f of ["src/components/wizard/wizard.tsx", "src/components/services/service-wizard.tsx"]) {
      const src = read(f);
      const call = src.indexOf('trackPixel(`register:${res.contestId}`, "CompleteRegistration");');
      expect(call, f).toBeGreaterThan(src.indexOf("await createAccountAndDraft("));
      expect(call, f).toBeGreaterThan(src.indexOf("if (!res.ok) {", src.indexOf("await createAccountAndDraft(")));
    }
  });

  it("Purchase: once the contest payment is paid and live, with what was paid in taka", () => {
    expect(read("src/app/start/result/page.tsx")).toContain('payment.purpose === "contest" && freshPurchase(payment.paidAt) && <PurchasePixel paymentId={payment.id} value={payment.amount} />');
    expect(read("src/app/client/contests/[id]/page.tsx")).toContain("contestPay && !unpaid && freshPurchase(contestPay.paidAt) && <PurchasePixel paymentId={contestPay.id} value={contestPay.amount} />");
    expect(read("src/components/analytics/purchase-pixel.tsx")).toContain('(ok ? trackPixel(key, "Purchase", { value, currency: "BDT" }) : markPixel(key))');
  });

  it("Purchase: once across all the client's devices, never for QA codes or staff using Log in as", () => {
    const claim = read("src/lib/analytics/purchase-actions.ts");
    expect(claim).toContain('if (!user || user.role !== "client" || (await viewingAs(user.id))) return false;');
    expect(claim).toContain('p.client_id !== user.id || p.purpose !== "contest" || p.status !== "paid"');
    expect(claim).toContain('?.qa === "1") return false;');
    expect(claim).toContain('.is("pixel_sent_at", null)');
    expect(read("supabase/migrations/0074_payment_pixel.sql")).toContain("alter table public.payments add column if not exists pixel_sent_at timestamptz;");
  });

  it("InitiateCheckout: paying starts a new one, but only when the payment is first handled here", () => {
    const px = read("src/components/analytics/purchase-pixel.tsx");
    expect(px.indexOf("endPixelStart();")).toBeGreaterThan(px.indexOf('if (typeof window.fbq !== "function" || pixelDone(key)) return;'));
  });

  it("Purchase: an ad-blocked browser doesn't use up the one claim", () => {
    const px = read("src/components/analytics/purchase-pixel.tsx");
    expect(px).toContain('const loaded = typeof (window.fbq as { callMethod?: unknown } | undefined)?.callMethod === "function";');
    expect(px.indexOf("if (!loaded) return;")).toBeLessThan(px.indexOf("claimPurchasePixel(paymentId)"));
  });

  it("the privacy policy names Meta, and its date moved on (again for wizard leads, 2026-10-25)", () => {
    for (const f of ["src/lib/legal/en.ts", "src/lib/legal/bn.ts"]) expect(read(f), f).toContain("Meta Pixel");
    expect(read("src/lib/legal/types.ts")).toContain('export const LEGAL_VERSION = "2026-10-26";');
  });

  it("Lead: only after the designer's account was created", () => {
    const src = read("src/components/designers/signup-flow.tsx");
    expect(src).toMatch(/if \(r\.ok\) \{\s*\/\/[^\n]*\n\s*trackPixel\(`lead:\$\{crypto\.randomUUID\(\)\}`, "Lead"\);/);
  });
});
