import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";

const FollowContext = createContext(null);

export function FollowProvider({ children }) {
  // Server-backed set of following user IDs (null = not loaded yet).
  const [followingIds, setFollowingIds] = useState(null);
  // Optimistic overrides after Follow / Following clicks.
  const [overrides, setOverrides] = useState({});

  const hydrate = useCallback(async () => {
    if (!getAuthToken()) {
      setFollowingIds(new Set());
      setOverrides({});
      return;
    }
    try {
      const res = await client.run("get", endpoints.followIds, {}, true);
      const ids = Array.isArray(res?.ids) ? res.ids.map((id) => String(id)) : [];
      const serverSet = new Set(ids);
      setFollowingIds(serverSet);
      // Keep only overrides that still disagree with the server (in-flight clicks).
      setOverrides((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (Boolean(value) !== serverSet.has(key)) {
            next[key] = value;
          }
        });
        return next;
      });
    } catch {
      setFollowingIds((prev) => prev || new Set());
    }
  }, []);

  useEffect(() => {
    hydrate();
    const onUser = () => hydrate();
    window.addEventListener("userUpdated", onUser);
    return () => window.removeEventListener("userUpdated", onUser);
  }, [hydrate]);

  const setFollowing = useCallback((userId, isFollowing) => {
    if (userId == null) return;
    const key = String(userId);
    const next = Boolean(isFollowing);

    setOverrides((prev) => ({
      ...prev,
      [key]: next,
    }));

    setFollowingIds((prev) => {
      const base = prev ? new Set(prev) : new Set();
      if (next) base.add(key);
      else base.delete(key);
      return base;
    });
  }, []);

  const isFollowing = useCallback(
    (userId, fallback = false) => {
      if (userId == null) return Boolean(fallback);
      const key = String(userId);

      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        return overrides[key];
      }
      if (followingIds) {
        return followingIds.has(key);
      }
      return Boolean(fallback);
    },
    [overrides, followingIds]
  );

  const value = useMemo(
    () => ({
      setFollowing,
      isFollowing,
      refreshFollowing: hydrate,
      followingReady: followingIds !== null,
    }),
    [setFollowing, isFollowing, hydrate, followingIds]
  );

  return (
    <FollowContext.Provider value={value}>{children}</FollowContext.Provider>
  );
}

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) {
    return {
      setFollowing: () => {},
      isFollowing: (_id, fallback) => Boolean(fallback),
      refreshFollowing: async () => {},
      followingReady: false,
    };
  }
  return ctx;
}
