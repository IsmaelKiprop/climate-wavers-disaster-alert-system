import { Link } from "react-router-dom";

export const fieldClass =
  "mt-1 h-11 w-full px-3 border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/25";

export const textareaClass =
  "mt-1 min-h-24 w-full px-3 py-2 border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/25";

export function ApplyHero({ eyebrow, title, description, links = [] }) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{eyebrow}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-muted text-base sm:text-lg leading-relaxed">{description}</p>
      {links.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {links.map((link, i) => (
            <span key={link.to} className="inline-flex items-center gap-3">
              {i > 0 ? <span className="text-muted" aria-hidden>·</span> : null}
              <Link to={link.to} className="text-primary hover:underline">
                {link.label}
              </Link>
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function ApplySteps({ steps }) {
  return (
    <ol className="mt-8 grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="border border-border bg-surface p-4 sm:p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step {index + 1}
          </p>
          <p className="mt-2 font-semibold text-foreground">{step.title}</p>
          <p className="mt-1 text-sm text-muted leading-relaxed">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function ApplyBenefits({ title, items }) {
  return (
    <aside className="border border-border bg-surface p-5 sm:p-6 h-fit lg:sticky lg:top-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm text-foreground leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function ApplyPlanCards({ plans, value, onChange, note }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">Choose a plan</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const selected = value === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => onChange(plan.key)}
              aria-pressed={selected}
              className={`text-left border p-4 transition-colors ${
                selected
                  ? "border-primary bg-surface-muted"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{plan.name}</p>
                {plan.featured ? (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-primary shrink-0">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">{plan.price}</p>
              <p className="mt-2 text-xs text-muted leading-relaxed">{plan.detail}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ApplySection({ title, description, children }) {
  return (
    <section className="border border-border bg-surface p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ApplyField({ label, hint, children, className = "" }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function ApplyLayout({ benefits, children }) {
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-start">
      {benefits}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
