import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SERVICES, LOGO, type ServiceDef } from "./types";

/**
 * Contest services as the admin set them (Admin → Services), on top of the built-in defaults. Before migration 0045
 * (or if the table can't be read) the defaults are used: only Logo is on.
 */
const loadAll = cache(async (): Promise<{ services: ServiceDef[]; ready: boolean }> => {
  const defaults = new Map(DEFAULT_SERVICES.map((s) => [s.slug, s]));
  if (!isSupabaseConfigured()) return { services: DEFAULT_SERVICES, ready: false };
  const { data, error } = await createAdminClient().from("contest_services").select("slug, is_on, position, def");
  if (error) return { services: DEFAULT_SERVICES, ready: false };
  const merged = new Map(defaults);
  for (const row of data ?? []) {
    const base = defaults.get(row.slug as string);
    const saved = (row.def ?? {}) as Partial<ServiceDef>;
    merged.set(row.slug as string, {
      ...(base ?? (DEFAULT_SERVICES[1] as ServiceDef)),
      ...saved,
      slug: row.slug as string,
      builtIn: base?.builtIn ?? false,
      on: Boolean(row.is_on),
      position: Number(row.position) || 0,
      fields: base?.builtIn ? [] : (saved.fields ?? base?.fields ?? []),
      winners: 1,
    });
  }
  const services = [...merged.values()].sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug));
  return { services, ready: true };
});

/** Every service, on or off, in the admin's order. */
export async function allServices(): Promise<ServiceDef[]> {
  return (await loadAll()).services;
}

/** True once migration 0045 has made the services table. */
export async function servicesReady(): Promise<boolean> {
  return (await loadAll()).ready;
}

/** The services clients can pick right now. */
export async function activeServices(): Promise<ServiceDef[]> {
  return (await allServices()).filter((s) => s.on);
}

/** One service by its slug (on or off), or null. */
export async function getService(slug: string | null | undefined): Promise<ServiceDef | null> {
  const key = slug || LOGO;
  return (await allServices()).find((s) => s.slug === key) ?? null;
}
