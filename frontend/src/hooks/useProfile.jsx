import { useQuery } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import {
  cacheProfileMedia,
  getUser,
  mergeUserMedia,
  normalizeUser,
  setUser,
  withCachedMedia,
} from "../utils/factory";

const seedUser = (userId) => {
  const me = withCachedMedia(normalizeUser(getUser()));
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
      const user = mergeUserMedia(seed || {}, normalizeUser(remote) || remote || {});
      cacheProfileMedia(user);
      if (seed && user?.id && String(user.id) === String(seed.id)) {
        setUser(user);
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
      const payload = await client.run("post", endpoints.profile, body, true);
      if (payload?.user) {
        payload.user = mergeUserMedia(
          seed || {},
          normalizeUser(payload.user) || payload.user
        );
        cacheProfileMedia(payload.user);
        if (seed?.id && String(payload.user.id) === String(seed.id)) {
          setUser(payload.user);
        }
      }
      return payload;
    },
    enabled: Boolean(user_id || username),
    staleTime: 15000,
    gcTime: 300000,
    retry: 1,
  });

  const rawUser = activity.data?.user || details.data || seed || null;
  const user = rawUser
    ? mergeUserMedia(seed || {}, normalizeUser(rawUser) || rawUser)
    : null;

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
