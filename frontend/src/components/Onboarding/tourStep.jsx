import Onboarding from "./Onboarding";
import { tour } from "./onboardingTour";

const TourStep = ({ stepKey }) => {
  const step = tour[stepKey];
  if (!step) return null;
  return (
    <Onboarding
      content={step.content}
      current={step.current}
      next={step.next}
      prev={step.prev}
      bot={step.bot}
    />
  );
};

export default TourStep;
