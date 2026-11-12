import { useState } from "react";
import {
  avatarFirstName,
  avatarInitial,
  avatarUrl,
  hasCustomAvatar,
} from "../utils/factory";

/**
 * Profile photo, or first-name label/initial (never gender M/F defaults).
 */
export default function UserAvatar({
  user,
  className = "h-10 w-10",
  textClassName = "text-sm",
  showFirstName = false,
  alt = "",
  onClick,
  style,
}) {
  const [broken, setBroken] = useState(false);
  const photo = !broken && hasCustomAvatar(user) ? avatarUrl(user) : "";
  const initial = avatarInitial(user);
  const firstName = avatarFirstName(user);
  const label = alt || firstName || "Profile";

  if (photo) {
    return (
      <img
        src={photo}
        alt={label}
        className={`object-cover bg-surface ${className}`}
        style={{ borderRadius: "50%", ...style }}
        decoding="async"
        onClick={onClick}
        onError={() => setBroken(true)}
      />
    );
  }

  // Never show a lonely "?" — wait for first name or use a neutral pulse.
  if (!firstName && initial === "?") {
    return (
      <div
        className={`bg-surface-muted animate-pulse ${className}`}
        style={{ borderRadius: "50%", ...style }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`bg-primary text-primary-foreground flex items-center justify-center font-semibold select-none ${className}`}
      style={{ borderRadius: "50%", ...style }}
      onClick={onClick}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      title={firstName || label}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      {showFirstName && firstName ? (
        <span className={`${textClassName} px-1.5 text-center leading-tight truncate max-w-full`}>
          {firstName}
        </span>
      ) : (
        <span className={textClassName}>{initial}</span>
      )}
    </div>
  );
}
