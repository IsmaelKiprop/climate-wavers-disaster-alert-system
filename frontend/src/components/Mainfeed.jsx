import Postcomponent from "./Postcomponent";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken, setUser, getUser } from "../utils/factory";
import ModernPostCreator from "./ModernPostCreator";
import { getLocation } from "../utils/location";
import { useEffect } from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const Mainfeed = () => {
  const accessToken = getAuthToken();

  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => getLocation())
      : window.setTimeout(() => getLocation(), 1500);
    return () => {
      if (window.cancelIdleCallback && typeof idle === "number") {
        window.cancelIdleCallback(idle);
      } else {
        window.clearTimeout(idle);
      }
    };
  }, []);

  useQuery({
    queryKey: ["userDetails"],
    enabled: Boolean(accessToken),
    staleTime: 120000,
    gcTime: 600000,
    retry: 1,
    queryFn: async () => {
      const data = await client.run("get", endpoints.user, {}, true);
      if (data) setUser({ ...(getUser() || {}), ...data });
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface p-3 sm:p-4">
        <ModernPostCreator type={"post"} />
      </div>
      <Postcomponent type={"post"} />
    </div>
  );
};

export default Mainfeed;
