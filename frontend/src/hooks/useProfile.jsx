import { useQuery } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser } from "../utils/factory";

const seedUser = (userId) => {
  const me = getUser();
  if (!me || !userId) return undefined;
  if (String(me.id) === String(userId)) return me;
  return undefined;
};

export const useProfile = ({ user_id }) => {
  const seed = seedUser(user_id);

  const details = useQuery({
    queryKey: ["profile", String(user_id || "")],
    queryFn: async () => client.run("get", `${endpoints.users}${user_id}/`, {}, true),
    enabled: Boolean(user_id),
    placeholderData: seed,
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
  });

  const activity = useQuery({
    queryKey: ["profile-activity", String(user_id || "")],
    queryFn: async () =>
      client.run("post", endpoints.profile, { user_id: Number(user_id) || user_id }, true),
    enabled: Boolean(user_id),
    staleTime: 15000,
    gcTime: 300000,
    retry: 1,
  });

  const user = activity.data?.user || details.data || seed || null;

  return {
    error: details.error || activity.error,
    isFetched: details.isFetched || Boolean(user),
    isLoading: details.isLoading && !user,
    data: activity.data
      ? activity.data
      : user
        ? { user, posts: [], comments: [], repost: [], bookmarks: [], reactions: [], polls: [] }
        : undefined,
    user,
    activity: activity.data,
    activityLoading: activity.isLoading,
  };
};
