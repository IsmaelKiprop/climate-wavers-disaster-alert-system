import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { loadFeedCache, saveFeedCache, feedCacheAgeLabel } from "../utils/feedCache";

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

  const cacheKey = ["post", type, postId, comment, page, pageSize];

  const fetchPosts = async () => {
    try {
      const res = await client.run("get", url, null, true);
      const pageData = normalizePostsResponse(res);
      saveFeedCache(cacheKey, pageData);
      return { ...pageData, _fromCache: false, _cacheAge: null };
    } catch (err) {
      const cached = loadFeedCache(cacheKey);
      if (cached?.page) {
        return {
          ...normalizePostsResponse(cached.page),
          _fromCache: true,
          _cacheAge: feedCacheAgeLabel(cached.savedAt),
          _offline: typeof navigator !== "undefined" && navigator.onLine === false,
        };
      }
      throw err;
    }
  };

  const cached = loadFeedCache(cacheKey);
  const placeholder = cached?.page
    ? {
        ...normalizePostsResponse(cached.page),
        _fromCache: true,
        _cacheAge: feedCacheAgeLabel(cached.savedAt),
      }
    : keepPreviousData;

  return useQuery({
    queryKey: cacheKey,
    queryFn: fetchPosts,
    enabled: Boolean(url),
    placeholderData: placeholder === keepPreviousData ? keepPreviousData : () => placeholder,
    initialData: cached?.page
      ? {
          ...normalizePostsResponse(cached.page),
          _fromCache: true,
          _cacheAge: feedCacheAgeLabel(cached.savedAt),
        }
      : undefined,
    refetchInterval: 300000,
    refetchIntervalInBackground: false,
    staleTime: 60000,
    gcTime: 600000,
    retry: 1,
    retryDelay: 1500,
    networkMode: "offlineFirst",
  });
};
