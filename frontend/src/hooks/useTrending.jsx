import { useQuery } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const useTrending = () => {
  return useQuery({
    queryKey: ["trending"],
    queryFn: async () => {
      const response = await client.run("get", endpoints.trending, null, true);
      const rows = Array.isArray(response) ? response : response?.results || [];
      return rows.filter((item) => String(item?.hashtags || "").trim());
    },
    refetchInterval: 120000,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    retryDelay: 1500,
  });
};

export { useTrending };
export default useTrending;
