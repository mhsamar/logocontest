import { emptyBrief, type Brief, type Order } from "@/lib/contests/brief";

export type LocalFile = {
  id: string; // key in IndexedDB
  name: string;
  type: string;
  size: number;
  isCurrentLogo: boolean;
};

export type ServerFile = { id: string; name: string; type: string; isCurrentLogo: boolean };

export type WizardState = {
  v: 1;
  brief: Brief;
  order: Order;
  mobile: string;
  email: string;
  contestId: string | null;
  localFiles: LocalFile[];
};

const KEY = "lc-wizard";

export function initialState(order: Order): WizardState {
  return { v: 1, brief: emptyBrief(), order, mobile: "", email: "", contestId: null, localFiles: [] };
}

/** Reads the autosaved wizard. Storage can be unavailable (private mode), so every access is guarded. */
export function loadState(): WizardState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardState;
    if (parsed?.v !== 1 || !parsed.brief || !parsed.order) return null;
    return { ...parsed, brief: { ...emptyBrief(), ...parsed.brief }, mobile: parsed.mobile ?? "", email: parsed.email ?? "", localFiles: parsed.localFiles ?? [] };
  } catch {
    return null;
  }
}

export function saveState(state: WizardState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Not fatal: the wizard still works, it just won't survive a reload.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
