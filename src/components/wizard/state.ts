import { emptyBrief, noUpgrades, type Brief, type Order } from "@/lib/contests/brief";

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
  /** The client's real name (owner, 2026-10-15: step 1, checked against the payment). */
  name?: string;
  mobile: string;
  /** The mobile's country, Bangladesh by default (owner, 2026-10-14). */
  mobileCountry?: string;
  /** "This number is on WhatsApp" (owner, 2026-10-14). */
  whatsapp?: boolean;
  email: string;
  contestId: string | null;
  localFiles: LocalFile[];
  /** The client agreed: no nude or sexual content in this contest (owner, 2026-10-12). */
  contentOk?: boolean;
  /** "Share my contest on Facebook" (owner, 2026-10-19): on unless the client switched it off. */
  shareFb?: boolean;
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
    const order = { ...parsed.order, upgrades: { ...noUpgrades(), ...parsed.order.upgrades } };
    return { ...parsed, order, brief: { ...emptyBrief(), ...parsed.brief }, mobile: parsed.mobile ?? "", email: parsed.email ?? "", localFiles: parsed.localFiles ?? [] };
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

/**
 * Reference photos still on this device for a saved draft (owner, 2026-10-22). Kept under the draft's own key, so the
 * client can leave for "Invite Pro designers" (or sign up, which reloads the wizard) and the review uploads them on
 * the way back. The files themselves stay in IndexedDB until they are uploaded.
 */
const pendingKey = (contestId: string) => `lc-wizard-pending:${contestId}`;

export function savePending(contestId: string, files: LocalFile[]) {
  try {
    if (files.length) localStorage.setItem(pendingKey(contestId), JSON.stringify(files));
    else localStorage.removeItem(pendingKey(contestId));
  } catch {
    /* ignore */
  }
}

export function loadPending(contestId: string): LocalFile[] {
  try {
    const raw = localStorage.getItem(pendingKey(contestId));
    const list = raw ? (JSON.parse(raw) as LocalFile[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
