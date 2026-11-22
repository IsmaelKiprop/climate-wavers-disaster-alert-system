/**
 * Facebook-style social offline: queue posts / replies / reactions until online.
 */
import { enqueueOfflineAction, getOfflineQueue, removeOfflineAction } from "./offlineQueue";
import { getUser } from "./factory";

export function listPendingSocialActions() {
  return getOfflineQueue().filter((item) =>
    [
      "create_post",
      "create_comment",
      "post_react",
      "post_unreact",
      "post_repost",
      "post_unrepost",
      "post_bookmark",
      "post_unbookmark",
    ].includes(item.type)
  );
}

export function listPendingPosts() {
  return listPendingSocialActions().filter(
    (item) => item.type === "create_post" || item.type === "create_comment"
  );
}

export function pendingSocialCount() {
  return listPendingSocialActions().length;
}

/** Optimistic card shown at top of feed while waiting to sync. */
export function pendingPostAsFeedItem(queueItem) {
  const user = getUser() || {};
  const payload = queueItem.payload || {};
  return {
    id: `pending_${queueItem.id}`,
    _pendingOffline: true,
    _queueId: queueItem.id,
    content: payload.content || "",
    visibility: payload.visibility || "Everyone",
    font_family: payload.font_family || "",
    location: payload.location || "",
    image: payload.image || null,
    video: payload.video || null,
    created: queueItem.createdAt,
    created_at: queueItem.createdAt,
    user: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_pic: user.profile_pic || user.picture,
    },
    reaction_count: 0,
    comment_count: 0,
    is_reacted: false,
    is_reposted: false,
    is_bookmarked: false,
  };
}

export function enqueueCreatePost(fields, { isComment = false } = {}) {
  return enqueueOfflineAction({
    type: isComment ? "create_comment" : "create_post",
    payload: {
      content: fields.content || "",
      visibility: fields.visibility || "Everyone",
      font_family: fields.font_family || "",
      location: fields.location || "",
      image: fields.image || null,
      video: fields.video || null,
      audio: fields.audio || null,
      post_id: fields.post_id || null,
      parent_comment: fields.parent_comment || null,
      endpoint: fields.endpoint,
    },
  });
}

export function enqueuePostReaction({ postType, postId, action }) {
  // action: react | unreact | repost | unrepost | bookmark | unbookmark
  const typeMap = {
    react: "post_react",
    unreact: "post_unreact",
    repost: "post_repost",
    unrepost: "post_unrepost",
    bookmark: "post_bookmark",
    unbookmark: "post_unbookmark",
  };
  return enqueueOfflineAction({
    type: typeMap[action] || "post_react",
    payload: { postType, postId, action },
  });
}

export function cancelPendingSocial(queueId) {
  removeOfflineAction(queueId);
}
