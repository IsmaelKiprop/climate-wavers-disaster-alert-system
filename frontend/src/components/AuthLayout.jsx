import { Link } from "react-router-dom";

const AuthLayout = ({
  title,
  subtitle,
  children,
  panelTitle = "Verify first. Send second.",
  panelBody = "Climate Wavers publishes live USGS and NASA events. FlowOps Africa in Nairobi is building the safeguards so AI does not amplify rumor as fact.",
  panelItems,
  footerNote = "Live official feeds. Human review before high-impact send.",
  align = "center",
}) => {
  const mainAlign = align === "start" ? "items-start" : "items-start sm:items-center";

  return (
    <div className="min-h-[100dvh] bg-background flex">
      <aside className="hidden lg:flex w-[42%] xl:w-[460px] shrink-0 bg-primary text-primary-foreground flex-col justify-between p-10 xl:p-12">
        <div>
          <Link to="/" className="flex items-center gap-3 text-primary-foreground">
            <img
              src="/logo.jpg"
              alt=""
              className="h-10 w-auto bg-surface p-1"
              style={{ borderRadius: 5 }}
            />
            <span className="text-lg font-semibold">Climate Wavers</span>
          </Link>
          <div className="mt-14 xl:mt-16">
            <h1 className="text-3xl xl:text-4xl font-semibold leading-tight max-w-md">
              {panelTitle}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-primary-foreground/90 max-w-md">
              {panelBody}
            </p>
            {panelItems?.length ? (
              <ul className="mt-8 space-y-3.5 max-w-md">
                {panelItems.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <span
                      className="mt-1.5 h-[5px] w-[5px] shrink-0 bg-primary-foreground"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-primary-foreground/80">{footerNote}</p>
      </aside>

      <main
        className={`flex-1 flex ${mainAlign} justify-center px-4 py-6 sm:px-8 sm:py-10 overflow-y-auto`}
      >
        <div className="w-full max-w-[480px]">
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2 mb-6 text-primary font-medium"
          >
            <img
              src="/logo.jpg"
              alt="Climate Wavers"
              className="h-8 w-auto"
              style={{ borderRadius: 5 }}
            />
            Climate Wavers
          </Link>
          <Link
            to="/"
            className="hidden lg:inline-flex items-center text-sm text-muted hover:text-primary mb-5"
          >
            Back to home
          </Link>
          <h2 className="text-2xl sm:text-[1.75rem] font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-muted text-sm sm:text-[0.95rem] leading-relaxed">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-6 sm:mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
};

export const AuthField = ({ id, label, error, hint, optional, children }) => (
  <div className="mb-3.5 sm:mb-4 min-w-0">
    <div className="flex items-baseline justify-between gap-3 mb-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {optional ? <span className="text-xs text-muted">Optional</span> : null}
    </div>
    {children}
    {error ? (
      <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
        {error}
      </p>
    ) : hint ? (
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
        {hint}
      </p>
    ) : null}
  </div>
);

export const AuthSection = ({ title, children }) => (
  <section className="mb-5 sm:mb-6 min-w-0">
    <h3 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border">
      {title}
    </h3>
    {children}
  </section>
);

export const authInputClass =
  "w-full min-h-11 h-11 px-3 border border-border bg-surface text-foreground text-base placeholder:text-muted disabled:opacity-60";

export const fieldInputClass = (error) =>
  `${authInputClass}${error ? " border-destructive" : ""}`;

export const authButtonClass =
  "w-full min-h-11 h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-dark active:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed";

export default AuthLayout;
