import { useState } from "react";
import CreateReport from "./CreateReport";
import AiReportAnalyse from "./AiReportAnalyse";

const Report = () => {
  const [result, setResult] = useState(null);

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
