"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SettingsState } from "@/lib/profile/actions";

/**
 * Save buttons (owner, 2026-10-15): in the brand colour while nothing is changed, green as soon as something is
 * changed, and back to the brand colour once the save worked. A failed save stays green (still not saved).
 */
export function useUnsaved(state: SettingsState) {
  // The save result at the moment of the last change; a newer successful result means it was saved since.
  const [changedAt, setChangedAt] = useState<SettingsState | null>(null);
  const unsaved = changedAt !== null && (changedAt === state || state.status !== "ok");
  return { unsaved, changed: () => setChangedAt(state) };
}

export function SaveButton({ unsaved, loading, children, type = "submit", onClick }: { unsaved: boolean; loading?: boolean; children: React.ReactNode; type?: "submit" | "button"; onClick?: () => void }) {
  return (
    <Button type={type} variant={unsaved ? "success" : "primary"} loading={loading} onClick={onClick}>
      {children}
    </Button>
  );
}
