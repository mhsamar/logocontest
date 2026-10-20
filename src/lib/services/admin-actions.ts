"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { allServices, servicesReady } from "./store";
import { parseService, type ServiceDef } from "./types";

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });

/** What a row stores besides slug, on/off and order. */
const defOf = (s: ServiceDef): Partial<ServiceDef> => {
  const rest: Partial<ServiceDef> = { ...s };
  delete rest.slug;
  delete rest.on;
  delete rest.position;
  delete rest.builtIn;
  return rest;
};

async function write(s: ServiceDef, adminId: string) {
  return createAdminClient()
    .from("contest_services")
    .upsert({ slug: s.slug, is_on: s.on, position: s.position, def: defOf(s), updated_at: new Date().toISOString(), updated_by: adminId });
}

/** Admin → Services (owner, 2026-10-13): switch a service on or off. At least one service always stays on. */
export async function setServiceOn(slug: string, on: boolean): Promise<Result> {
  const admin = await adminUser("services.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!(await servicesReady())) return fail("admin.services.errors.notReady");
  const list = await allServices();
  const s = list.find((x) => x.slug === slug);
  if (!s) return fail("auth.errors.generic");
  if (!on && list.filter((x) => x.on && x.slug !== slug).length === 0) return fail("admin.services.errors.lastOn");
  const { error } = await write({ ...s, on }, admin.id);
  if (error) return fail("admin.errors.generic");
  // Activity shows who changed it, when, and old → new (owner, 2026-10-13). Running contests are not touched.
  await audit(admin.id, "update_service", "contest_service", slug, { field: "is_live", from: s.on ? "on" : "off", to: on ? "on" : "off" });
  refresh();
  return { ok: true };
}

/** Saves a service's texts, sizes, files, brief questions and defaults; a new slug adds a service (off). */
export async function saveService(raw: unknown, isNew: boolean): Promise<Result> {
  const admin = await adminUser("services.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!(await servicesReady())) return fail("admin.services.errors.notReady");
  const list = await allServices();
  const slug = raw && typeof raw === "object" ? String((raw as Record<string, unknown>).slug ?? "") : "";
  const existing = list.find((x) => x.slug === slug) ?? null;
  if (isNew && existing) return fail("admin.services.errors.slugTaken");
  if (!isNew && !existing) return fail("auth.errors.generic");
  const parsed = parseService(raw, existing);
  if (!parsed.ok) return fail(`admin.services.errors.${parsed.error}` as MessageKey);
  const s = isNew ? { ...parsed.service, on: false, position: Math.max(0, ...list.map((x) => x.position)) + 1 } : parsed.service;
  const { error } = await write(s, admin.id);
  if (error) return fail("admin.errors.generic");
  // Each changed part, old → new (owner, 2026-10-13).
  const before = (existing ? defOf(existing) : {}) as Record<string, unknown>;
  const after = defOf(s) as Record<string, unknown>;
  const changes = Object.fromEntries(
    Object.keys(after)
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => [k, { from: before[k] ?? null, to: after[k] }]),
  );
  await audit(admin.id, isNew ? "add_service" : "update_service", "contest_service", s.slug, { changes });
  refresh();
  return { ok: true };
}

/** Moves a service one place up or down in the list (the order clients see). */
export async function moveService(slug: string, dir: -1 | 1): Promise<Result> {
  const admin = await adminUser("services.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!(await servicesReady())) return fail("admin.services.errors.notReady");
  const list = await allServices();
  const i = list.findIndex((x) => x.slug === slug);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  const order = [...list];
  [order[i], order[j]] = [order[j], order[i]];
  const db = createAdminClient();
  const rows = order.map((s, n) => ({ slug: s.slug, is_on: s.on, position: n, def: defOf(s), updated_at: new Date().toISOString(), updated_by: admin.id }));
  const { error } = await db.from("contest_services").upsert(rows);
  if (error) return fail("admin.errors.generic");
  refresh();
  return { ok: true };
}
