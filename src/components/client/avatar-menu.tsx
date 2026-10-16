"use client";

/* eslint-disable @next/next/no-img-element */
import { usePathname } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import { cx } from "@/lib/cx";
import { logout } from "@/lib/auth/actions";
import { CwIcon } from "./icons";

export type AvatarEvent = "toggle" | "outside" | "escape" | "navigate";

/** Click the photo: open or close; click outside, Escape or a new page: close (CLIENT-HANDOFF §1). */
export function avatarMenuReducer(open: boolean, event: AvatarEvent): boolean {
  return event === "toggle" ? !open : false;
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

/** The round photo, or the initials on green. */
export function ClientAvatar({ name, url, large = false }: { name: string; url: string | null; large?: boolean }) {
  return <span className={cx("cav", large && "lg")}>{url ? <img src={url} alt="" /> : <b>{initialsOf(name)}</b>}</span>;
}

/**
 * What the dropdown holds: only the client's name, the business name and Log out (CLIENT-HANDOFF §1). Kept apart
 * from the open/close logic so the tests can render it.
 */
export function AvatarMenuPanel({ name, business, avatarUrl, logoutLabel, action, open }: { name: string; business: string | null; avatarUrl: string | null; logoutLabel: string; action: () => void | Promise<void>; open: boolean }) {
  return (
    <div className={cx("cdd", open && "open")} role="menu" data-avatar-menu>
      <div className="cddh">
        <ClientAvatar name={name} url={avatarUrl} />
        <div>
          <b>{name}</b>
          {business && <em>{business}</em>}
        </div>
      </div>
      <form action={action}>
        <button type="submit" role="menuitem" className="cddl" data-logout>
          <CwIcon name="logout" size={17} strokeWidth={2.2} />
          {logoutLabel}
        </button>
      </form>
    </div>
  );
}

/** The client's photo in the top bar: a green ring, a red dot when something is new, and the dropdown. */
export function ClientAvatarMenu({ name, business, avatarUrl, news, accountLabel, logoutLabel }: { name: string; business: string | null; avatarUrl: string | null; news: boolean; accountLabel: string; logoutLabel: string }) {
  const [open, dispatch] = useReducer(avatarMenuReducer, false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => dispatch("navigate"), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && dispatch("outside");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dispatch("escape");
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="ctr">
      <button type="button" className="cuav" aria-label={accountLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => dispatch("toggle")} data-avatar>
        <ClientAvatar name={name} url={avatarUrl} large />
        {news && <i className="cdot" />}
        <CwIcon name="chevron" size={16} strokeWidth={2.4} />
      </button>
      <AvatarMenuPanel name={name} business={business} avatarUrl={avatarUrl} logoutLabel={logoutLabel} action={logout} open={open} />
    </div>
  );
}
