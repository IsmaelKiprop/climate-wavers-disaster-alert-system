import { useState } from "react";

export const StatusBadge = ({ value, tone = "neutral" }) => {
  const tones = {
    ok: "border-primary text-primary",
    warn: "border-[#b45309] text-[#b45309]",
    bad: "border-destructive text-destructive",
    neutral: "border-border text-muted",
  };
  return (
    <span
      className={`inline-flex items-center h-6 px-2 text-[11px] uppercase tracking-wide border font-semibold ${
        tones[tone] || tones.neutral
      }`}
    >
      {value || "—"}
    </span>
  );
};

export const statusTone = (status) => {
  const s = String(status || "").toLowerCase();
  if (["active", "approved", "completed", "verified", "live", "ok"].includes(s)) return "ok";
  if (["pending", "monitoring", "trial", "unverified"].includes(s)) return "warn";
  if (["rejected", "suspended", "failed", "cancelled", "inactive"].includes(s)) return "bad";
  return "neutral";
};

export const StatStrip = ({ items = [] }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
    {items.map((item) => (
      <div key={item.label} className="border border-border bg-surface p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted">{item.label}</p>
        <p className="text-2xl font-semibold text-foreground mt-1">{item.value ?? "—"}</p>
      </div>
    ))}
  </div>
);

export const AdminFilters = ({ children, onSubmit, className = "" }) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit?.(e);
    }}
    className={`flex flex-col sm:flex-row flex-wrap gap-2 ${className}`}
  >
    {children}
  </form>
);

export const FilterInput = (props) => (
  <input
    {...props}
    className={`h-10 border border-border bg-background px-3 text-sm min-w-0 sm:min-w-[180px] ${
      props.className || ""
    }`}
  />
);

export const FilterSelect = ({ children, ...props }) => (
  <select
    {...props}
    className={`h-10 border border-border bg-background px-3 text-sm ${props.className || ""}`}
  >
    {children}
  </select>
);

export const FilterButton = ({ children, variant = "primary", ...props }) => (
  <button
    type={props.type || "submit"}
    {...props}
    className={`h-10 px-3 text-sm font-medium ${
      variant === "primary"
        ? "bg-primary text-primary-foreground"
        : "border border-border text-foreground"
    } disabled:opacity-50 ${props.className || ""}`}
  >
    {children}
  </button>
);

export const AdminTable = ({ columns = [], rows = [], empty = "No rows", mobileCard }) => {
  if (!rows.length) {
    return (
      <div className="border border-border bg-surface p-6 text-sm text-muted text-center">
        {empty}
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block border border-border overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface border-b border-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-[11px] uppercase tracking-wide text-muted font-semibold whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? JSON.stringify(row)} className="border-b border-border last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3 align-top">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <div key={row.id ?? JSON.stringify(row)} className="border border-border bg-surface p-3">
            {mobileCard ? mobileCard(row) : (
              <div className="space-y-2 text-sm">
                {columns.map((col) => (
                  <div key={col.key} className="flex justify-between gap-3">
                    <span className="text-muted text-xs uppercase tracking-wide">{col.label}</span>
                    <span className="text-right">{col.render ? col.render(row) : row[col.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export const ConfirmAction = ({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  busy,
  variant = "primary",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`inline-flex flex-col items-stretch gap-1 ${className}`}>
      {!open ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(true)}
          className={`h-9 px-2.5 text-xs font-medium ${
            variant === "danger"
              ? "border border-destructive text-destructive"
              : variant === "ghost"
                ? "border border-border"
                : "bg-primary text-primary-foreground"
          } disabled:opacity-50`}
        >
          {label}
        </button>
      ) : (
        <div className="flex gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await onConfirm?.();
              setOpen(false);
            }}
            className="h-9 px-2.5 text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50"
          >
            {busy ? "…" : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="h-9 px-2.5 text-xs border border-border"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle ? <p className="text-sm text-muted mt-1">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </div>
);

export const DetailField = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    <div className="mt-1 text-sm text-foreground break-words">{children || "—"}</div>
  </div>
);

export const DetailPanel = ({ title, subtitle, badge, empty, children, actions }) => (
  <aside className="border border-border bg-surface p-4 sm:p-5 sticky top-4">
    {!children ? (
      <p className="text-sm text-muted">{empty || "Select a row to review full details."}</p>
    ) : (
      <div className="space-y-4">
        {(title || badge) && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted">Application detail</p>
              {title ? (
                <h2 className="text-lg font-semibold text-foreground mt-1 break-words">{title}</h2>
              ) : null}
              {subtitle ? <p className="text-xs text-muted mt-1">{subtitle}</p> : null}
            </div>
            {badge ? <div className="flex flex-wrap gap-1 justify-end shrink-0">{badge}</div> : null}
          </div>
        )}
        {children}
        {actions ? <div className="flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div> : null}
      </div>
    )}
  </aside>
);

export const loadMoreBtn = ({ page, setOffset, loading }) =>
  page?.next_offset != null ? (
    <button
      type="button"
      disabled={loading}
      onClick={() => setOffset(page.next_offset)}
      className="mt-4 h-10 px-4 border border-border text-sm w-full sm:w-auto"
    >
      {loading ? "Loading…" : "Load more"}
    </button>
  ) : null;
