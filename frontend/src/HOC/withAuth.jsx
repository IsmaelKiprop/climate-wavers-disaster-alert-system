import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const withAuth = (WrappedComponent) => {
  const WithAuth = (props) => {
    const navigate = useNavigate();
    const location = useLocation();
    const token = Cookies.get("accessToken");
    const raw = Cookies.get("user");
    const next = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

    useEffect(() => {
      if (!raw && token) {
        client
          .run("get", endpoints?.user, {}, true)
          .then((user) => {
            Cookies.set("user", JSON.stringify(user));
          })
          .catch(() => {
            navigate(next);
          });
      } else if (!token) {
        navigate(next);
      }
    }, [raw, token, navigate, next]);

    if (!raw && !token) return null; // Avoid rendering if the user is not authenticated

    return <WrappedComponent {...props} />;
  };

  // Set the displayName for easier debugging
  WithAuth.displayName = `WithAuth(${getDisplayName(WrappedComponent)})`;

  return WithAuth;
};

// Helper function to get the display name of the wrapped component
const getDisplayName = (WrappedComponent) => {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
};

export default withAuth;
