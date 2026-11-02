import Postcomponent from "./Postcomponent";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getAuthToken, setUser } from "../utils/factory";
import Cookies from "js-cookie";
import ModernPostCreator from "./ModernPostCreator";
import { getLocation } from "../utils/location";
import { useEffect } from "react";
import { env } from "../config/env";

const Mainfeed = () => {
  const BACKENDURL = env.backendUrl;
  const accessToken = getAuthToken();

  useEffect(() => {
    getLocation();
  }, []);


  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-CSRFToken": `${Cookies.get("csrftoken")}`,
  };
  const endpoint = `${BACKENDURL}/api/v1/auth/user/`;
  const fetchUserDetailsFn = async () => {
    const res = await axios.get(endpoint, {
      headers: headers,
      withCredentials: true,
    });
    return res.data;
  };

  const { data, isFetched } = useQuery({
    queryKey: ["userDetails"],
    queryFn: fetchUserDetailsFn,
  });

  useEffect(() => {
    if (isFetched && data) setUser(data);
  }, [isFetched, data]);

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
