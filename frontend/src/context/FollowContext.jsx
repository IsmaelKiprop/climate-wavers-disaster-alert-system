import { createContext, useCallback, useContext, useMemo, useState } from "react";

const FollowContext = createContext(null);

export function FollowProvider({ children }) {
  const [overrides, setOverrides] = useState({});

  const setFollowing = useCallback((userId, isFollowing) => {
    if (userId == null) return;
    setOverrides((prev) => ({
      ...prev,
      [String(userId)]: Boolean(isFollowing),
    }));
  }, []);

  const isFollowing = useCallback(
    (userId, fallback = false) => {
      if (userId == null) return Boolean(fallback);
      const key = String(userId);
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        return overrides[key];
      }
      return Boolean(fallback);
    },
    [overrides]
  );

  const value = useMemo(
    () => ({ setFollowing, isFollowing }),
    [setFollowing, isFollowing]
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
    };
  }
  return ctx;
}
