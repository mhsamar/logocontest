"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Bottom sheet on phones, centred dialog from the sm breakpoint up.
 * Built on <dialog> so focus trapping and Esc-to-close come from the browser.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel: string;
  /** "wide" for panels with several cards (e.g. add-ons). */
  size?: "default" | "wide";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={
        "m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/50 backdrop:animate-fade-in " +
        (size === "wide" ? "sm:m-auto sm:max-w-2xl" : "sm:m-auto sm:max-w-md")
      }
    >
      <div className="animate-sheet-up rounded-t-xl bg-surface shadow-raised sm:animate-dialog-in sm:rounded-lg">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:pt-5">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-2 -mt-1 flex size-11 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 pb-5 pt-2 text-[0.9375rem] text-muted">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
