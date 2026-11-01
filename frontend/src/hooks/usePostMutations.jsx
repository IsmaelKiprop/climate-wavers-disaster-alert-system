import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { getAuthToken } from "../utils/factory";
import { useState } from "react";
import { env } from "../config/env";

export const usePostMutations = () => {
  const BACKENDURL = env.backendUrl;
  const accessToken = getAuthToken();
  const queryClient = useQueryClient();
  const [posttype, setType] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-CSRFToken": `${Cookies.get("csrftoken")}`,
  };

  const useCreateMutation = (url, type) => {
    return useMutation({
      mutationFn: ({postType, post}) => {
        setType(postType);
        return axios.post(
          `${url}${postType}/${post}/${type}/`,
          {},
          { headers, withCredentials: true }
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries([posttype]);
      },
    });
  };

  return {
    likeMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "react"),
    unlikeMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "unreact"),
    repostMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "repost"),
    unrepostMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "unrepost"),
    saveMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "bookmark"),
    unsaveMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "unbookmark"),
  };
};

export default usePostMutations;
