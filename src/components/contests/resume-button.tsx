"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** "Continue my contest" on a resume link's page (owner, 2026-10-26): busy while the client is signed in. */
export function ResumeButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      {label}
    </Button>
  );
}
