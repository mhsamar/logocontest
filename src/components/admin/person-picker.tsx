"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchPeople, type PersonHit } from "@/lib/support/actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { AdminIcon } from "./icons";

type Role = "all" | "client" | "designer";
export type PickedPerson = { id: string; name: string; role: "client" | "designer" | null; username: string | null };

/** Designers and clients each have their own colour, everywhere in the picker (owner, 2026-10-10). */
const ROLE_PILL = { designer: "bg-[#e6effa] text-adm-chart-prize", client: "bg-tint text-primary" } as const;
const ROLE_DOT = { designer: "bg-adm-chart-prize", client: "bg-primary" } as const;

function Avatar({ person }: { person: Pick<PersonHit, "name" | "avatar" | "role"> }) {
  if (person.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatar} alt="" className={cx("size-10 shrink-0 rounded-full object-cover ring-2", person.role === "designer" ? "ring-adm-chart-prize/40" : "ring-primary/40")} />;
  }
  return (
    <span aria-hidden className={cx("flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold", ROLE_PILL[person.role])}>
      {person.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function RolePill({ role }: { role: "client" | "designer" }) {
  const { t } = useI18n();
  return <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", ROLE_PILL[role])}>{t(`admin.users.roles.${role}`)}</span>;
}

/**
 * A-25 "One person": click to see the newest clients and designers, type to search by name, username,
 * email or mobile, filter by role, then pick one. The chosen person shows as a card with Change.
 */
export function PersonPicker({ value, onChange }: { value: PickedPerson | null; onChange: (p: PickedPerson | null) => void }) {
  const { t } = useI18n();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role>("all");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  // Search as the admin types (short pause so every key press isn't a request).
  useEffect(() => {
    if (!open) return;
    let stale = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchPeople(query, role);
      if (stale) return;
      setHits(res);
      setActive(0);
      setLoading(false);
    }, 220);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [open, query, role]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (p: PersonHit) => {
    onChange({ id: p.id, name: p.name, role: p.role, username: p.username });
    setOpen(false);
    setQuery("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) return setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      pick(hits[active]);
    }
  };

  if (value) {
    return (
      <div className="mt-1 flex min-h-14 items-center gap-3 rounded-xl bg-canvas px-3 py-2 ring-1 ring-inset ring-line">
        {value.role && <span aria-hidden className={cx("size-2.5 shrink-0 rounded-full", ROLE_DOT[value.role])} />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong className="truncate text-[15px] text-ink">{value.name}</strong>
            {value.role && <RolePill role={value.role} />}
          </span>
          {value.username && <span className="block truncate text-xs text-muted">@{value.username}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(true);
            requestAnimationFrame(() => input.current?.focus());
          }}
          className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-bold text-primary hover:bg-tint"
        >
          {t("admin.messages.picker.change")}
        </button>
      </div>
    );
  }

  const roles: Role[] = ["all", "designer", "client"];
  return (
    <div ref={box} className="relative mt-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <AdminIcon name="search" size={17} />
      </span>
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${hits[active].id}` : undefined}
        value={query}
        placeholder={t("admin.messages.picker.placeholder")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        className="block min-h-11 w-full rounded-xl bg-canvas pl-10 pr-3 text-sm text-ink ring-1 ring-inset ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[16px] bg-surface shadow-[0_18px_40px_rgb(17_18_22/0.14)] ring-1 ring-adm-line">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-adm-line-soft p-2">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cx(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold",
                  role === r ? "bg-ink text-white" : "text-adm-strong hover:bg-adm-bg",
                )}
              >
                {r !== "all" && <span aria-hidden className={cx("size-2 rounded-full", ROLE_DOT[r])} />}
                {t(`admin.messages.picker.${r}`)}
              </button>
            ))}
            <span className="ml-auto px-2 text-xs text-muted">{loading ? t("admin.messages.picker.loading") : query.trim() ? t("admin.messages.picker.found", { n: String(hits.length) }) : t("admin.messages.picker.newest")}</span>
          </div>

          <ul id={listId} role="listbox" aria-label={t("admin.messages.person")} className="m-0 max-h-[min(420px,55dvh)] list-none overflow-y-auto p-1.5">
            {hits.length === 0 && !loading && <li className="px-3 py-6 text-center text-sm text-muted">{t("admin.messages.picker.none")}</li>}
            {hits.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(p)}
                className={cx("flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2", i === active ? "bg-adm-bg" : "")}
              >
                <Avatar person={p} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-[15px] text-ink">{p.name}</strong>
                    <RolePill role={p.role} />
                    {p.banned && <span className="rounded-full bg-adm-bad-bg px-2 py-0.5 text-xs font-bold text-adm-bad">{t("admin.messages.picker.banned")}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{[p.username && `@${p.username}`, p.mobile, p.email].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
