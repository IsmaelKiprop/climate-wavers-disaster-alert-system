import { Link } from "react-router-dom";

const AuthLayout = ({
  title,
  subtitle,
  children,
  panelTitle = "Verify first. Send second.",
  panelBody = "Climate Wavers publishes live USGS and NASA events. FlowOps Africa in Nairobi is building the safeguards so AI does not amplify rumor as fact.",
}) => {
  return (
    <div className="min-h-[100dvh] bg-background flex">
      <aside className="hidden lg:flex w-[42%] bg-primary text-primary-foreground flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-3 text-primary-foreground">
          <img src="/logo.jpg" alt="Climate Wavers" className="h-10 w-auto bg-white p-1" style={{ borderRadius: 5 }} />
          <span className="text-lg font-semibold">Climate Wavers</span>
        </Link>
        <div>
          <h1 className="text-4xl font-semibold leading-tight max-w-md">{panelTitle}</h1>
          <p className="mt-4 text-base leading-relaxed text-white/90 max-w-md">{panelBody}</p>
        </div>
        <p className="text-sm text-white/80">Live official feeds. Human review before high-impact send.</p>
      </aside>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-5 sm:px-8 sm:py-8 overflow-y-auto">
        <div className="w-full max-w-[440px] py-2 sm:py-4">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-5 text-primary font-medium">
            <img src="/logo.jpg" alt="Climate Wavers" className="h-8 w-auto" style={{ borderRadius: 5 }} />
            Climate Wavers
          </Link>
          <Link to="/" className="inline-flex items-center text-sm text-muted hover:text-primary mb-4">
            Back to home
          </Link>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-2 text-muted text-sm sm:text-base">{subtitle}</p> : null}
          <div className="mt-5 sm:mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
};

export const AuthField = ({ id, label, error, children }) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
      {label}
    </label>
    {children}
    {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
  </div>
);

export const authInputClass =
  "w-full h-11 px-3 border border-border bg-surface text-foreground text-base disabled:opacity-60";

export const authButtonClass =
  "w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed";

export default AuthLayout;
