import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { ONBOARDING_TOTAL } from "./onboardingTour";

const Onboarding = ({ content, current, next, prev, bot, total = ONBOARDING_TOTAL }) => {
  const cards = (content || []).filter((msg) => !msg.view);

  return (
    <section className="min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link to={prev || "/onboarding"} className="text-muted hover:text-foreground">
          Back
        </Link>
        <p className="text-muted">
          {current}/{total}
        </p>
        <Link to="/app" className="text-muted hover:text-foreground">
          Skip
        </Link>
      </div>

      <div className="mt-4 h-1 w-full bg-border overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.round((Number(current) / Number(total)) * 100))}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 py-8">
        <figure className="w-full max-w-[220px] sm:max-w-[260px]">
          <img src={`/${bot}.png`} alt="" className="w-full h-auto" />
        </figure>

        <div className="w-full max-w-md space-y-3">
          <div className="space-y-2">
            {cards.map((msg) => (
              <article key={msg.title} className="border border-border bg-surface px-4 py-4">
                <h2 className="text-base font-semibold">{msg.title}</h2>
                <p className="mt-2 text-sm text-muted leading-relaxed">{msg.message}</p>
              </article>
            ))}
          </div>
          <Link
            to={next || "/app"}
            className="inline-flex items-center justify-center w-full sm:w-auto min-w-[160px] px-5 py-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          >
            {next && next !== "/app" ? "Continue" : "Open the app"}
          </Link>
        </div>
      </div>
    </section>
  );
};

Onboarding.propTypes = {
  content: PropTypes.array.isRequired,
  next: PropTypes.string,
  prev: PropTypes.string,
  bot: PropTypes.string,
  current: PropTypes.number,
  total: PropTypes.number,
};

export default Onboarding;
