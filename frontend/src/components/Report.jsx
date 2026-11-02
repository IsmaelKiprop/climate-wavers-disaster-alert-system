import { useState } from "react";
import CreateReport from "./CreateReport";
import AiReportAnalyse from "./AiReportAnalyse";

const Report = () => {
  const [step, setStep] = useState("form");
  const [report, setReport] = useState(null);

  if (step === "done" && report) {
    return (
      <AiReportAnalyse
        disaster={report.disaster}
        recommendation={report.recommendation}
      />
    );
  }

  return (
    <CreateReport
      onSubmitted={(payload) => {
        setReport(payload);
        setStep("done");
      }}
    />
  );
};

export default Report;
