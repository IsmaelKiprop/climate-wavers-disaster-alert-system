import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  completeAuthSession,
  getAuthToken,
  getUser,
} from "../utils/factory";

const withAuth = (WrappedComponent) => {
  const WithAuth = (props) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [ready, setReady] = useState(false);
    const next = `/login?redirect=${encodeURIComponent(
      location.pathname + location.search
    )}`;

    useEffect(() => {
      let active = true;
      const boot = async () => {
        const token = getAuthToken();
        const user = getUser();
        if (!token && !user) {
          navigate(next, { replace: true });
          return;
        }
        if (token) {
          const needsProfile =
            !user ||
            !(user.profile_picture || user.profile_pic || user.picture) ||
            !user.first_name;
          if (needsProfile) {
            await completeAuthSession({ access_token: token, ...(user || {}) });
          }
        }
        if (!active) return;
        if (!getAuthToken() && !getUser()) {
          navigate(next, { replace: true });
          return;
        }
        setReady(true);
      };
      boot();
      return () => {
        active = false;
      };
    }, [navigate, next]);

    if (!ready) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center bg-background">
          <p className="text-sm text-muted">Opening your workspace…</p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  WithAuth.displayName = `WithAuth(${getDisplayName(WrappedComponent)})`;
  return WithAuth;
};

const getDisplayName = (WrappedComponent) =>
  WrappedComponent.displayName || WrappedComponent.name || "Component";

export default withAuth;
