import { IoEyeOutline } from "react-icons/io5";
import { isOwnContent } from "../utils/postOwnership";

function formatImpressions(value) {
  const count = Number(value) || 0;
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return count.toLocaleString();
}

/**
 * LinkedIn-style impressions row — shown to the post author.
 */
export default function PostImpressions({ post, className = "" }) {
  if (!isOwnContent(post)) return null;

  const count = Number(post?.total_views) || 0;
  const label = count === 1 ? "impression" : "impressions";

  return (
    <div
      className={`flex items-center gap-2 text-sm text-muted ${className}`}
      title="Times your post was seen"
    >
      <IoEyeOutline size={18} className="text-muted shrink-0" aria-hidden />
      <span className="font-semibold text-foreground tabular-nums">
        {formatImpressions(count)}
      </span>
      <span>{label}</span>
    </div>
  );
}
