import { Link } from "react-router-dom";

const BotLeg = () => {
  return (
    <section className="min-h-[calc(100dvh-8rem)] flex flex-col items-center justify-center gap-6 py-8 text-center">
      <figure className="w-full max-w-[220px]">
        <img src="/waverbotlegs.png" alt="" className="w-full h-auto" />
      </figure>
      <p className="max-w-md text-base leading-relaxed">Got my legs. Let us keep going.</p>
      <Link
        to="/onboarding/bot"
        className="inline-flex items-center justify-center px-5 py-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
      >
        Continue
      </Link>
    </section>
  );
};

export default BotLeg;
