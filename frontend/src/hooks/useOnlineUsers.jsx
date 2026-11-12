import { useQuery } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";

const normalizeOnlinePayload = (data) => {
  if (Array.isArray(data)) {
    return { count: data.length, results: data };
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    count: typeof data?.count === "number" ? data.count : results.length,
    results,
  };
};

const useOnlineUsers = (options = {}) => {
  const limit = options.limit ?? 100;
  const refetchInterval = options.refetchInterval ?? 20000;
  const enabled = options.enabled !== false && Boolean(getAuthToken());

  return useQuery({
    queryKey: ["onlineUsers", limit],
    enabled,
    queryFn: async () => {
      const data = await client.run(
        "get",
        `${endpoints.usersOnline}?limit=${limit}`,
        {},
        true
      );
      return normalizeOnlinePayload(data);
    },
    refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
    retry: 1,
  });
};

export { useOnlineUsers };
export default useOnlineUsers;
