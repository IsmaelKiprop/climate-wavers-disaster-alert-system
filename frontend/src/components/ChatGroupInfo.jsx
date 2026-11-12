import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IoChevronForward,
  IoClose,
  IoPeopleOutline,
  IoSearchOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { avatarUrl, secureMediaUrl } from "../utils/factory";
import { profilePath } from "../utils/linkify";
import ImageLightbox from "./ImageLightbox";

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
  const content = (
    <>
      <span className="relative shrink-0">
        <img
          src={avatarUrl(person)}
          alt=""
          className="h-12 w-12 rounded-full object-cover bg-background"
          onError={(e) => {
            e.currentTarget.src = "/avatar.png";
          }}
        />
        {person.is_online ? (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-surface" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium truncate">{displayName(person)}</span>
        <span className="block text-xs text-muted truncate">
          {badge || (
            <>
              @{person.username || "member"}
              {person.is_online ? " · online" : ""}
            </>
          )}
        </span>
      </span>
      <IoChevronForward size={16} className="shrink-0 text-muted" />
    </>
  );

  if (!to) {
    return <li className="flex items-center gap-3 px-4 py-3">{content}</li>;
  }

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={to}
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-3 hover:bg-background"
      >
        {content}
      </Link>
    </li>
  );
};

const ChatGroupInfo = ({ open, onClose, loading, data, conversationName }) => {
  const [logoPreview, setLogoPreview] = useState(null);
  const [memberQuery, setMemberQuery] = useState("");

  const group = data?.group;
  const members = data?.members || [];
  const logo = secureMediaUrl(group?.cover_image || group?.avatar || "", "");
  const isCommunity = data?.conversation_type === "community";
  const title = isCommunity ? "Community info" : "Group info";
  const kindLabel = isCommunity ? "Community" : "Group";

  const filtered = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const list = members || [];
    if (!q) return list;
    return list.filter((person) => {
      const hay = `${person.first_name || ""} ${person.last_name || ""} ${person.username || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, memberQuery]);

  const admins = filtered.filter((m) => m.role === "owner" || m.role === "admin");
  const others = filtered.filter((m) => m.role !== "owner" && m.role !== "admin");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/40" role="dialog" aria-modal="true">
      <button
        type="button"
        className="hidden sm:block flex-1 cursor-default"
        aria-label={`Close ${title}`}
        onClick={onClose}
      />
      <aside className="h-full w-full sm:max-w-md bg-surface border-l border-border shadow-xl flex flex-col">
        <header className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border bg-surface">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 min-w-10 flex items-center justify-center text-foreground"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
          <h2 className="text-base font-semibold">{title}</h2>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 px-4 py-8 bg-background border-b border-border">
            <button
              type="button"
              className="h-28 w-28 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center shadow-sm"
              onClick={() => {
                if (logo) setLogoPreview({ src: logo, type: "image" });
              }}
              aria-label={logo ? "View logo" : "Group logo"}
            >
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <IoPeopleOutline size={44} className="text-muted" />
              )}
            </button>
            <div className="text-center max-w-sm">
              <p className="text-xl font-semibold">
                {group?.name || conversationName || "Group"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {kindLabel} · {group?.member_count ?? members.length} participants
              </p>
            </div>
          </div>

          <div className="px-4 py-4 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Description
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {(group?.description || "").trim() || "No description yet."}
            </p>
          </div>

          <div className="px-4 py-3 border-b border-border">
            <label className="flex items-center gap-2 h-11 px-3 border border-border bg-background">
              <IoSearchOutline size={18} className="text-muted shrink-0" />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search members"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          {loading && !members.length ? (
            <p className="p-4 text-sm text-muted">Loading members…</p>
          ) : (
            <>
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {filtered.length} participant{filtered.length === 1 ? "" : "s"}
                </p>
              </div>

              {admins.length ? (
                <section className="pb-2">
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Admins
                  </p>
                  <ul className="bg-surface">
                    {admins.map((person) => (
                      <MemberRow
                        key={`admin-${person.id}`}
                        person={person}
                        onClose={onClose}
                        badge={
                          <span className="inline-flex items-center gap-1 text-primary">
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

              <section className="pb-6">
                {admins.length ? (
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Members
                  </p>
                ) : null}
                <ul className="bg-surface">
                  {(others.length || !admins.length ? others : filtered).map((person) => (
                    <MemberRow
                      key={`member-${person.id}`}
                      person={person}
                      onClose={onClose}
                    />
                  ))}
                  {!filtered.length ? (
                    <li className="px-4 py-6 text-sm text-muted">No members match that search.</li>
                  ) : null}
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
