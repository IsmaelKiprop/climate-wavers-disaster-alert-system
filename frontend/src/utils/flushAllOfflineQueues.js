/**
 * Flush every Climate Wavers offline field queue when connectivity returns.
 * Safe to call repeatedly; individual flushes keep permanent failures out of the queue.
 */
import { apiUrl, env } from "../config/env";
import { endpoints } from "./endpoints";
import { getAuthToken } from "./factory";
import { flushOfflineQueue } from "./offlineQueue";
import { flushPlasticOfflineProofs, listPlasticOfflineProofs } from "./plasticOfflineQueue";
import {
  flushTreeSurvivalOffline,
  listTreeSurvivalOffline,
} from "./treeOfflineQueue";
import {
  flushHazardCorroborationOffline,
  listHazardCorroborationOffline,
} from "./hazardOfflineQueue";
import axios from "axios";
import { prependCachedDisaster } from "./apiData";

async function authFetch(path, body, { formData = false } = {}) {
  const token = getAuthToken();
  const headers = {
    Accept: "application/json",
  };
  if (!formData) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: formData ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (typeof data.detail === "string" && data.detail) ||
        data.message ||
        "Request failed"
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function syncCreatePost(payload) {
  const endpoint = payload.endpoint || endpoints.post;
  const formData = new FormData();
  formData.append("content", payload.content || "");
  formData.append("visibility", payload.visibility || "Everyone");
  if (payload.font_family) formData.append("font_family", payload.font_family);
  if (payload.location) formData.append("location", payload.location);
  // Comments API expects `post`; keep post_id for older queued payloads.
  if (payload.post_id) {
    formData.append("post", payload.post_id);
    formData.append("post_id", payload.post_id);
  }
  if (payload.parent_comment) {
    formData.append("parent_comment", payload.parent_comment);
  }
  if (payload.image) formData.append("image", payload.image);
  if (payload.video) formData.append("video", payload.video);
  return authFetch(endpoint, formData, { formData: true });
}

async function syncPostReaction(payload) {
  const { postType, postId, action } = payload;
  const token = getAuthToken();
  const res = await fetch(
    `${env.backendUrl}/api/v1/${postType}/${postId}/${action}/`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: "{}",
      credentials: "include",
    }
  );
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

async function syncDisasterReport(payload) {
  const source = { ...payload };
  if (!source.clientReportId && !source.client_report_id) {
    const raw = JSON.stringify(source);
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
    source.clientReportId = `offline_${(hash >>> 0).toString(36)}`;
  }
  const { data } = await axios.post(apiUrl("/api/v1/community-reports/"), source);
  if (data?.disaster) prependCachedDisaster(data.disaster);
  return data;
}

export function pendingOfflineCount() {
  // Field queues only — social/disaster actions already live in offlineQueueCount().
  return (
    listPlasticOfflineProofs().length +
    listTreeSurvivalOffline().length +
    listHazardCorroborationOffline().length
  );
}

export async function flushAllOfflineQueues() {
  const summary = {
    disasters: { synced: [], remaining: [], failed: [] },
    plastic: { synced: [], remaining: [], failed: [] },
    trees: { synced: [], remaining: [], failed: [] },
    hazards: { synced: [], remaining: [], failed: [] },
  };

  try {
    const disasters = await flushOfflineQueue({
      disaster_report: syncDisasterReport,
      create_post: syncCreatePost,
      create_comment: syncCreatePost,
      post_react: syncPostReaction,
      post_unreact: syncPostReaction,
      post_repost: syncPostReaction,
      post_unrepost: syncPostReaction,
      post_bookmark: syncPostReaction,
      post_unbookmark: syncPostReaction,
    });
    summary.disasters = {
      synced: Array(disasters.sent || 0).fill(true),
      remaining: Array(disasters.remaining || 0).fill(true),
      failed: Array(disasters.failed || 0).fill(true),
    };
  } catch {
    /* queue may be empty / API down */
  }

  if (listPlasticOfflineProofs().length) {
    summary.plastic = await flushPlasticOfflineProofs((payload) =>
      authFetch(endpoints.plasticRecoveries, payload)
    );
  }

  if (listTreeSurvivalOffline().length) {
    summary.trees = await flushTreeSurvivalOffline((checkinId, body) =>
      authFetch(endpoints.treeSurvivalSubmit(checkinId), body)
    );
  }

  if (listHazardCorroborationOffline().length) {
    summary.hazards = await flushHazardCorroborationOffline((disasterId, body) =>
      authFetch(endpoints.hazardCorroborate(disasterId), body)
    );
  }

  return summary;
}
