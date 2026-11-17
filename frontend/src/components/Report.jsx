import { useState } from "react";
import CreateReport from "./CreateReport";
import AiReportAnalyse from "./AiReportAnalyse";

const Report = () => {
  const [result, setResult] = useState(null);

  if (result?.queued) {
    return (
      <div className="p-5 space-y-3">
        <p className="text-lg font-semibold text-foreground">Saved on this device</p>
        <p className="text-sm text-muted">
          {result.message ||
            "Your report is queued. Climate Wavers will send it automatically when you're back online."}
        </p>
        <button
          type="button"
          className="min-h-11 px-4 bg-primary text-primary-foreground text-sm font-medium"
          onClick={() => setResult(null)}
        >
          Report another
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <AiReportAnalyse
        disaster={result.disaster}
        recommendation={result.recommendation}
        vision={result.vision}
        alert={result.alert}
      />
    );
  }

  return <CreateReport onSubmitted={setResult} />;
};

export default Report;
