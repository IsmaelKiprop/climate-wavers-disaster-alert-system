import { getUser } from "./factory";

/** True when the signed-in user owns this post/comment. */
export function isOwnContent(content, me = getUser()) {
  if (!content || !me?.id) return false;
  const authorId =
    content.user?.id ??
    content.user?.pk ??
    content.user_id ??
    content.author?.id ??
    content.author_id;
  if (authorId != null && String(authorId) === String(me.id)) return true;
  const myEmail = String(me.email || "").toLowerCase();
  const authorEmail = String(content.user?.email || "").toLowerCase();
  if (myEmail && authorEmail && myEmail === authorEmail) return true;
  return false;
}
