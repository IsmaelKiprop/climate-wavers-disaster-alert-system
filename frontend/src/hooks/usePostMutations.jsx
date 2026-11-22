import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { getAuthToken } from "../utils/factory";
import { useState } from "react";
import { toast } from "react-toastify";
import { env } from "../config/env";
import { enqueuePostReaction } from "../utils/socialOffline";

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
      mutationFn: async ({ postType, post }) => {
        setType(postType);
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          enqueuePostReaction({
            postType,
            postId: post,
            action: type,
          });
          toast.info("Saved — will sync when you're back online");
          return { data: { offline: true } };
        }
        try {
          return await axios.post(
            `${url}${postType}/${post}/${type}/`,
            {},
            { headers, withCredentials: true }
          );
        } catch (err) {
          const status = Number(err?.response?.status || err?.status || 0);
          if (status === 0 || status >= 500) {
            enqueuePostReaction({ postType, postId: post, action: type });
            toast.info("Saved offline — will sync when connection returns");
            return { data: { offline: true } };
          }
          throw err;
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries([posttype]);
      },
      networkMode: "always",
    });
  };

  return {
    likeMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "react"),
    unlikeMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "unreact"),
    repostMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "repost"),
    unrepostMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "unrepost"),
    saveMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "bookmark"),
    unsaveMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "unbookmark"),
    viewMutation: useCreateMutation(`${BACKENDURL}/api/v1/`, "view"),
  };
};

export default usePostMutations;
