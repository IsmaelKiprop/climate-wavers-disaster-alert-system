import { Link } from "react-router-dom";
import { IoClose, IoPeopleOutline, IoShieldCheckmarkOutline } from "react-icons/io5";
import { avatarUrl, secureMediaUrl } from "../utils/factory";
import { profilePath } from "../utils/linkify";
import ImageLightbox from "./ImageLightbox";
import { useState } from "react";

function displayName(person) {
  if (!person) return "Member";
  const full = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return full || person.username || "Member";
}

function roleLabel(role) {
  if (role === "owner") return "Group admin";
  if (role === "admin") return "Admin";
  return "Member";
}

const MemberRow = ({ person, onClose, badge }) => {
  const to = person?.id ? profilePath(person.id) : "";
  const inner = (
    <>
      <span className="relative shrink-0">
        <img
          src={avatarUrl(person)}
          alt=""
          className="h-10 w-10 rounded-full object-cover bg-background"
        />
        {person.is_online ? (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium truncate">{displayName(person)}</span>
        <span className="block text-xs text-muted truncate">
          {badge || (
            <>
              @{person.username || "member"}
              {person.role && person.role !== "member"
                ? ` · ${roleLabel(person.role)}`
                : ""}
              {person.is_online ? " · online" : ""}
            </>
          )}
        </span>
      </span>
    </>
  );

  if (!to) {
    return <li className="flex items-center gap-3">{inner}</li>;
  }

  return (
    <li>
      <Link
        to={to}
        onClick={onClose}
        className="flex items-center gap-3 rounded-sm hover:bg-background px-1 py-1 -mx-1"
      >
        {inner}
      </Link>
    </li>
  );
};

const ChatGroupInfo = ({ open, onClose, loading, data, conversationName }) => {
  const [logoPreview, setLogoPreview] = useState(null);
  if (!open) return null;

  const group = data?.group;
  const members = data?.members || [];
  const logo = secureMediaUrl(group?.cover_image || "", "");
  const admins = members.filter((m) => m.role === "owner" || m.role === "admin");
  const others = members.filter((m) => m.role !== "owner" && m.role !== "admin");
  const isCommunity = data?.conversation_type === "community";
  const title = isCommunity ? "Community info" : "Group info";
  const kindLabel = isCommunity ? "Community" : "Group";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/30" role="dialog" aria-modal="true">
      <button type="button" className="flex-1 cursor-default" aria-label={`Close ${title}`} onClick={onClose} />
      <aside className="h-full w-full max-w-md bg-surface border-l border-border shadow-lg flex flex-col">
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 min-w-10 flex items-center justify-center text-muted hover:text-foreground"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 px-4 py-6 border-b border-border">
            <button
              type="button"
              className="h-24 w-24 rounded-full overflow-hidden bg-background border border-border flex items-center justify-center"
              onClick={() => {
                if (logo) setLogoPreview({ src: logo, type: "image" });
              }}
              aria-label={logo ? "View logo" : "Group logo"}
            >
              {logo ? (
                <img src={logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <IoPeopleOutline size={40} className="text-muted" />
              )}
            </button>
            <div className="text-center">
              <p className="text-lg font-semibold">{group?.name || conversationName || "Group"}</p>
              <p className="mt-1 text-sm text-muted">
                {kindLabel} · {group?.member_count ?? members.length} members
              </p>
            </div>
          </div>

          <div className="px-4 py-4 border-b border-border">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Description</p>
            <p className="mt-2 text-sm whitespace-pre-wrap break-words">
              {(group?.description || "").trim() || "No description yet."}
            </p>
          </div>

          {loading ? (
            <p className="p-4 text-sm text-muted">Loading members…</p>
          ) : (
            <>
              {admins.length ? (
                <section className="px-4 py-4 border-b border-border">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                    Admins ({admins.length})
                  </p>
                  <ul className="space-y-2">
                    {admins.map((person) => (
                      <MemberRow
                        key={person.id}
                        person={person}
                        onClose={onClose}
                        badge={
                          <span className="inline-flex items-center gap-1">
                            <IoShieldCheckmarkOutline size={12} />
                            {roleLabel(person.role)}
                            {person.is_online ? " · online" : ""}
                          </span>
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                  Members ({others.length || members.length})
                </p>
                <ul className="space-y-2">
                  {(others.length ? others : members).map((person) => (
                    <MemberRow key={person.id} person={person} onClose={onClose} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </aside>

      {logoPreview?.src ? (
        <ImageLightbox
          src={logoPreview.src}
          type={logoPreview.type || "image"}
          alt="Group logo"
          onClose={() => setLogoPreview(null)}
        />
      ) : null}
    </div>
  );
};

export default ChatGroupInfo;
