import HazardCorroborationPanel from "../components/HazardCorroborationPanel";

const CorroboratePage = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Community ground truth
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Corroborate hazards
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Nearby members can confirm or deny active reports with a geotagged
          photo. Three confirms can escalate a report to alert status.
        </p>
      </header>
      <HazardCorroborationPanel />
    </div>
  );
};

export default CorroboratePage;
