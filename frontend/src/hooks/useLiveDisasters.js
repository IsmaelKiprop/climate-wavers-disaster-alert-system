import { useQuery } from "@tanstack/react-query";
import { fetchDisasters } from "../utils/apiData";

export const useLiveDisasters = () => {
  return useQuery({
    queryKey: ["liveDisasters"],
    queryFn: fetchDisasters,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 15000,
    gcTime: 300000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    retryDelay: 1500,
  });
};

export default useLiveDisasters;
