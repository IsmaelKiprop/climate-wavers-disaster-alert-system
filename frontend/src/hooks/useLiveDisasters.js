import { useQuery } from "@tanstack/react-query";
import { fetchDisasters } from "../utils/apiData";
import { readCachedDisasters } from "../utils/disasterCache";

export const useLiveDisasters = () => {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return useQuery({
    queryKey: ["liveDisasters"],
    queryFn: fetchDisasters,
    initialData: () => readCachedDisasters(),
    initialDataUpdatedAt: () => (readCachedDisasters() ? Date.now() - 20000 : 0),
    refetchInterval: offline ? false : 60000,
    refetchIntervalInBackground: false,
    staleTime: 45000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnMount: !offline,
    networkMode: "offlineFirst",
    retry: offline ? 0 : 1,
    retryDelay: 1500,
    placeholderData: (previous) => previous ?? readCachedDisasters(),
  });
};

export default useLiveDisasters;
