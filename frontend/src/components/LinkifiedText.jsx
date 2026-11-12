import { Link } from "react-router-dom";
import { tokenizeRichText } from "../utils/linkify";

/**
 * Renders plain text with clickable http(s)/www links, #hashtags, and @mentions.
 */
const LinkifiedText = ({
  text = "",
  mentions = [],
  className = "",
  linkClassName = "underline underline-offset-2 break-all",
  hashtagClassName = "font-semibold text-[#067d83] hover:text-[#055a5f]",
  mentionClassName = "font-semibold underline underline-offset-2",
  onLinkClick,
}) => {
  const parts = tokenizeRichText(text, { mentions });
  if (!parts.length) return null;

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((part, index) => {
        const key = `${part.type}-${index}-${part.value.slice(0, 24)}`;
        if (part.type === "url") {
          return (
            <a
              key={key}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
              onClick={(e) => {
                e.stopPropagation();
                onLinkClick?.(e, part);
              }}
            >
              {part.value}
            </a>
          );
        }
        if (part.type === "hashtag") {
          return (
            <Link
              key={key}
              to={part.href}
              className={hashtagClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {part.value}
            </Link>
          );
        }
        if (part.type === "mention") {
          return (
            <span key={key} className={mentionClassName}>
              {part.value}
            </span>
          );
        }
        return <span key={key}>{part.value}</span>;
      })}
    </span>
  );
};

export default LinkifiedText;
