"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ContestChecks } from "@/lib/logo-check/queries";
import { CheckDialog } from "./check-dialog";

/** A design the client can pick in step 1 of the pop-up. */
export type CheckerDesign = { id: string; number: number; coverUrl: string | null; designer: string | null };

/** What the pop-up needs about the contest page it opens on (owner, 2026-10-10). */
export type CheckerSetup = {
  contest: { id: string; slug: string; brand: string };
  designs: CheckerDesign[];
  state: ContestChecks;
  /** The AI and a web search are switched on. */
  ready: boolean;
  /** Google Lens (SearchAPI) is switched on, so the search can be named that way. */
  lens: boolean;
};

type Open = { entryId?: string | null; checkId?: string; step?: 3 | 4 };
type Ctx = { setup: CheckerSetup | null; lens: boolean; open: (o: Open) => void };

const CheckerCtx = createContext<Ctx | null>(null);

export function useChecker(): Ctx {
  const ctx = useContext(CheckerCtx);
  if (!ctx) throw new Error("useChecker outside CheckerProvider");
  return ctx;
}

/**
 * Holds the AI copyright checker pop-up for a page. On the contest page it gets the contest setup (designs,
 * checks left); on My logo checks it only opens finished checks (`setup` null).
 */
export function CheckerProvider({ setup, lens, children }: { setup: CheckerSetup | null; lens: boolean; children: React.ReactNode }) {
  const [dialog, setDialog] = useState<Open | null>(null);
  const open = useCallback((o: Open) => setDialog(o), []);
  const value = useMemo(() => ({ setup, lens, open }), [setup, lens, open]);
  return (
    <CheckerCtx.Provider value={value}>
      {children}
      {dialog && <CheckDialog setup={setup} lens={lens} initial={dialog} onClose={() => setDialog(null)} />}
    </CheckerCtx.Provider>
  );
}
