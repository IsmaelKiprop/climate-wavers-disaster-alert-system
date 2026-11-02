import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const emptyPage = { results: [], count: 0, next: null, previous: null };

const normalizePostsResponse = (res) => {
  if (Array.isArray(res)) {
    return {
      results: res.filter((item) => item && item.id),
      count: res.length,
      next: null,
      previous: null,
    };
  }

  if (res && Array.isArray(res.results)) {
    return {
      results: res.results.filter((item) => item && item.id),
      count: typeof res.count === "number" ? res.count : res.results.length,
      next: res.next ?? null,
      previous: res.previous ?? null,
    };
  }

  return emptyPage;
};

export const useFetchPosts = ({ type, postId, comment, page = 1, pageSize = 10 }) => {
  let url;
  if (postId && type === "comments" && !comment) {
    url = `${endpoints.comments}?post=${postId}`;
  } else if (comment && type === "comments") {
    url = `${endpoints.comments}?parent=${comment}`;
  } else if (type === "post") {
    url = `${endpoints.post}?page=${page}&page_size=${pageSize}`;
  }

  const fetchPosts = async () => {
    const res = await client.run("get", url, null, true);
    return normalizePostsResponse(res);
  };

  return useQuery({
    queryKey: ["post", type, postId, comment, page, pageSize],
    queryFn: fetchPosts,
    enabled: Boolean(url),
    placeholderData: keepPreviousData,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
    staleTime: 60000,
    gcTime: 600000,
    retry: 1,
    retryDelay: 1500,
  });
};
