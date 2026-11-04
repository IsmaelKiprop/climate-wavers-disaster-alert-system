import { useQuery } from "@tanstack/react-query";
import { fetchDisasters } from "../utils/apiData";
import { readCachedDisasters } from "../utils/disasterCache";

export const useLiveDisasters = () => {
  return useQuery({
    queryKey: ["liveDisasters"],
    queryFn: fetchDisasters,
    initialData: () => readCachedDisasters(),
    initialDataUpdatedAt: () => (readCachedDisasters() ? Date.now() - 20000 : 0),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 45000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
    retryDelay: 1500,
  });
};

export default useLiveDisasters;
