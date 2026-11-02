import { useLiveDisasters } from "./useLiveDisasters";

const CLIMATE_TYPES = new Set(["wildfire", "drought", "heatwave", "flood", "storm"]);

const useFeedData = (feedType) => {
  const live = useLiveDisasters();
  const events = live.data || [];

  let data = events;
  if (feedType === "Climate Action") {
    data = events.filter((event) => CLIMATE_TYPES.has(String(event.disasterType || "").toLowerCase()));
  } else if (feedType === "Alerts") {
    data = events.filter((event) => ["HIGH", "CRITICAL"].includes(String(event.severity || "").toUpperCase()));
  }

  return {
    ...live,
    data,
  };
};

export { useFeedData };
export default useFeedData;
