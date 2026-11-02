import { Link } from "react-router-dom";

const Welcome = () => {
  return (
    <section className="min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="flex justify-end">
        <Link
          to="/app"
          className="inline-flex items-center px-3 py-2 text-sm font-medium border border-border bg-surface hover:bg-background"
        >
          Skip
        </Link>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 py-8">
        <figure className="w-full max-w-[240px] sm:max-w-[280px]">
          <img src="/waverbot1.png" alt="WaverX, the Climate Wavers assistant" className="w-full h-auto" />
        </figure>

        <div className="w-full max-w-md space-y-3">
          <p className="text-sm text-muted">WaverX</p>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">Welcome to Climate Wavers</h1>
          <div className="space-y-2">
            <p className="bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">
              Hello. Welcome to Climate Wavers.
            </p>
            <p className="bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">
              I am WaverX, the assistant for live alerts and community reports.
            </p>
            <p className="bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">
              Let me show you around.
            </p>
          </div>
          <Link
            to="/onboarding/home"
            className="inline-flex items-center justify-center w-full sm:w-auto min-w-[160px] px-5 py-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          >
            Let&apos;s go
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Welcome;
