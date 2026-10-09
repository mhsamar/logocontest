/** Title row of an admin page. */
export function AdminHead({ title, lead, actions }: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{title}</h1>
        {lead && <p className="mt-1 max-w-3xl text-sm text-muted">{lead}</p>}
      </div>
      {actions}
    </div>
  );
}
