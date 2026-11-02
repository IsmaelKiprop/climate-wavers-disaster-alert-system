import { Link } from "react-router-dom";

const GrabLeg = () => {
  return (
    <section className="min-h-[calc(100dvh-8rem)] flex flex-col items-center justify-center gap-6 py-8 text-center">
      <figure className="w-full max-w-[220px]">
        <img src="/waverbot1.png" alt="" className="w-full h-auto" />
      </figure>
      <p className="max-w-md text-base leading-relaxed">Give me a moment while I grab my legs.</p>
      <Link
        to="/onboarding/botleg"
        className="inline-flex items-center justify-center px-5 py-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
      >
        Continue
      </Link>
    </section>
  );
};

export default GrabLeg;
