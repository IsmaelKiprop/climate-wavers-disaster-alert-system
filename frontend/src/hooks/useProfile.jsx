import { useQuery } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser, normalizeUser, setUser } from "../utils/factory";

const seedUser = (userId) => {
  const me = normalizeUser(getUser());
  if (!me || !userId) return undefined;
  if (String(me.id) === String(userId)) return me;
  return undefined;
};

export const useProfile = ({ user_id, username } = {}) => {
  const seed = seedUser(user_id);
  const key = user_id ? `id:${user_id}` : username ? `user:${username}` : "";

  const details = useQuery({
    queryKey: ["profile", key],
    queryFn: async () => {
      if (!user_id) return null;
      const remote = await client.run("get", `${endpoints.users}${user_id}/`, {}, true);
      const user = normalizeUser(remote) || remote;
      if (seed && user?.id && String(user.id) === String(seed.id)) {
        setUser({ ...seed, ...user });
      }
      return user;
    },
    enabled: Boolean(user_id),
    placeholderData: seed,
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
  });

  const activity = useQuery({
    queryKey: ["profile-activity", key],
    queryFn: async () => {
      const body = user_id
        ? { user_id: Number(user_id) || user_id }
        : { username };
      return client.run("post", endpoints.profile, body, true);
    },
    enabled: Boolean(user_id || username),
    staleTime: 15000,
    gcTime: 300000,
    retry: 1,
  });

  const user = activity.data?.user || details.data || seed || null;

  return {
    error: details.error || activity.error,
    isFetched: details.isFetched || activity.isFetched || Boolean(user),
    isLoading: (details.isLoading || activity.isLoading) && !user,
    isPending: details.isPending || activity.isPending,
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
