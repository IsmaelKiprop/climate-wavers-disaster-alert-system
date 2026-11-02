import { Link } from "react-router-dom";
import { safetyStepsFor } from "../utils/safetyGuidance";
import { toHttpsUrl } from "../utils/apiData";

const AiReportAnalyse = ({ disaster, recommendation, vision, alert }) => {
  const type = disaster?.disasterType || disaster?.type || vision?.suggestedType || "";
  const steps = safetyStepsFor(type);
  const image = toHttpsUrl(disaster?.images?.[0] || disaster?.image || "");
  const title = [disaster?.region, disaster?.country].filter(Boolean).join(", ") || "Community report";
  const visionLabel = vision?.inference || vision?.label || disaster?.vision || "";
  const alertSent = Boolean(alert?.mail || alert?.inApp || alert?.queue);

  return (
    <div className="p-4 sm:p-5 space-y-4">
      <p className="text-xs uppercase tracking-wide text-muted">Report received</p>
      <h2 className="text-lg font-semibold">
        Your {String(type || "disaster").toLowerCase()} report is logged as unconfirmed
      </h2>
      <p className="text-sm text-muted">
        {title}. Climate Wavers will not treat this as confirmed until source, location, and a human review check out.
      </p>

      {image ? (
        <img src={image} alt="" className="w-full h-40 object-cover border border-border bg-background" />
      ) : null}

      {visionLabel ? (
        <p className="text-sm">
          <span className="font-medium">Computer vision:</span> {visionLabel}
        </p>
      ) : null}

      <p className="text-sm">
        <span className="font-medium">Alerts:</span>{" "}
        {alertSent
          ? `Triggered for ${disaster?.region || "this location"}. In-app notices and email go to matching members.`
          : "The report is saved. Alert delivery will retry if a service is still waking up."}
      </p>

      <div>
        <h3 className="font-medium">What to do now</h3>
        <ol className="mt-2 space-y-2 text-sm">
          {steps.map((step) => (
            <li key={step} className="border border-border bg-background p-3">
              {step}
            </li>
          ))}
        </ol>
      </div>
      {recommendation ? <p className="sr-only">{recommendation}</p> : null}

      {disaster?.id ? (
        <Link
          to={`/disasters/${encodeURIComponent(disaster.id)}`}
          className="inline-flex min-h-11 items-center px-4 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
        >
          View this report
        </Link>
      ) : null}
    </div>
  );
};

export default AiReportAnalyse;
