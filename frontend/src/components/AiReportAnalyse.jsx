import { Link } from "react-router-dom";
import { safetyStepsFor } from "../utils/safetyGuidance";
import { toHttpsUrl } from "../utils/apiData";

const AiReportAnalyse = ({ disaster, recommendation }) => {
  const type = disaster?.disasterType || disaster?.type || "";
  const steps = safetyStepsFor(type);
  const image = toHttpsUrl(disaster?.images?.[0] || disaster?.image || "");
  const title = [disaster?.region, disaster?.country].filter(Boolean).join(", ") || "Community report";

  return (
    <div className="max-h-[80vh] overflow-y-auto p-1">
      <p className="text-xs uppercase tracking-wide text-muted">Report received</p>
      <h2 className="mt-1 text-lg font-semibold">
        Your {String(type || "disaster").toLowerCase()} report is logged as unconfirmed
      </h2>
      <p className="mt-2 text-sm text-muted">
        {title}. Climate Wavers will not broadcast this as a confirmed event until source, location, and a human review check out.
      </p>

      {image ? (
        <img src={image} alt="" className="mt-4 w-full h-40 object-cover border border-border bg-background" />
      ) : null}

      <h3 className="mt-5 font-medium">What to do now</h3>
      <ol className="mt-2 space-y-2 text-sm">
        {steps.map((step) => (
          <li key={step} className="border border-border bg-surface p-3">
            {step}
          </li>
        ))}
      </ol>
      {recommendation ? <p className="sr-only">{recommendation}</p> : null}

      {disaster?.id ? (
        <Link
          to={`/disasters/${encodeURIComponent(disaster.id)}`}
          className="mt-5 inline-flex min-h-11 items-center px-4 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
        >
          View this report
        </Link>
      ) : null}
    </div>
  );
};

export default AiReportAnalyse;
