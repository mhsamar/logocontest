export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border border-dashed border-line bg-surface px-6 py-12 text-center">
      <div className="mb-4 flex size-[52px] items-center justify-center rounded-2xl bg-tint text-primary">
        {icon ?? (
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M8 12h8M12 8v8" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h3 className="m-0 text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      {body && <p className="m-0 mt-1.5 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
