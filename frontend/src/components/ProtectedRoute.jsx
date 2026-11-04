import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { completeAuthSession, getAuthToken, getUser } from "../utils/factory";

const ProtectedRoute = ({ children, redirectTo = "/login" }) => {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const boot = async () => {
      const token = getAuthToken();
      const user = getUser();
      if (!token && !user) {
        if (active) {
          setAllowed(false);
          setReady(true);
        }
        return;
      }
      if (token && (!user || !(user.profile_picture || user.profile_pic || user.picture))) {
        await completeAuthSession({ access_token: token, ...(user || {}) });
      }
      if (active) {
        setAllowed(Boolean(getAuthToken() || getUser()));
        setReady(true);
      }
    };
    boot();
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center bg-background">
        <p className="text-sm text-muted">Opening your workspace…</p>
      </div>
    );
  }

  if (!allowed) {
    const currentPath = location.pathname + location.search;
    return (
      <Navigate
        to={`${redirectTo}?redirect=${encodeURIComponent(currentPath)}`}
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;
