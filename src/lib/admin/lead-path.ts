/**
 * Where a lead's details open (owner, 2026-10-25): its row on Unpaid contests, open and scrolled to. Keyed by the
 * visit's id, never the mobile number, so no number lands in an address, a notification or browser history. Pure.
 */
export const leadPath = (visitId: string) => `/admin/unpaid?sel=g:${encodeURIComponent(visitId)}#lead`;
