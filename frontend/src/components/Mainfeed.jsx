import Postcomponent from "./Postcomponent";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getAuthToken } from "../utils/factory";
import Cookies from "js-cookie";
import Createcomment from "./Createcomment";
import ModernPostCreator from "./ModernPostCreator";
import { getLocation } from "../utils/location";
import { useEffect, useState } from "react";
import { env } from "../config/env";

const Mainfeed = () => {
  const BACKENDURL = env.backendUrl;
  const accessToken = getAuthToken();
  const [useModernPostCreator, setUseModernPostCreator] = useState(true);
  
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
  if (isFetched) {
    // Set cookies without domain restriction for development
    Cookies.set("user", JSON.stringify(data));
  }

  return (
    <div className="text-2xl pt-1 md:pt-5">
      {/* Toggle between old and new post creator */}
      <div className="mb-4 flex justify-center">
        <button
          onClick={() => setUseModernPostCreator(!useModernPostCreator)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
        >
          {useModernPostCreator ? "Use Simple Creator" : "Use AI-Powered Creator"}
        </button>
      </div>
      
      <div className="border-2 rounded-lg md:shadow-3xl md:my-4 mt-[24px]">
        {useModernPostCreator ? (
          <ModernPostCreator type={"post"} />
        ) : (
          <Createcomment type={"post"} />
        )}
      </div>
      <Postcomponent type={"post"} />
    </div>
  );
};

export default Mainfeed;
