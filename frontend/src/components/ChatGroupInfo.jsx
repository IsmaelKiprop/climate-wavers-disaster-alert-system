import { IoClose, IoPeopleOutline, IoShieldCheckmarkOutline } from "react-icons/io5";
import { avatarUrl, secureMediaUrl } from "../utils/factory";

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

const ChatGroupInfo = ({ open, onClose, loading, data, conversationName }) => {
  if (!open) return null;

  const group = data?.group;
  const members = data?.members || [];
  const logo = secureMediaUrl(group?.cover_image || "", "");
  const admins = members.filter((m) => m.role === "owner" || m.role === "admin");
  const others = members.filter((m) => m.role !== "owner" && m.role !== "admin");

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/30" role="dialog" aria-modal="true">
      <button type="button" className="flex-1 cursor-default" aria-label="Close group info" onClick={onClose} />
      <aside className="h-full w-full max-w-md bg-surface border-l border-border shadow-lg flex flex-col">
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold">Group info</h2>
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
            <span className="h-24 w-24 rounded-full overflow-hidden bg-background border border-border flex items-center justify-center">
              {logo ? (
                <img src={logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <IoPeopleOutline size={40} className="text-muted" />
              )}
            </span>
            <div className="text-center">
              <p className="text-lg font-semibold">{group?.name || conversationName || "Group"}</p>
              <p className="mt-1 text-sm text-muted">
                Group · {group?.member_count ?? members.length} members
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
                  <ul className="space-y-3">
                    {admins.map((person) => (
                      <li key={person.id} className="flex items-center gap-3">
                        <img
                          src={avatarUrl(person)}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover bg-background"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{displayName(person)}</p>
                          <p className="text-xs text-muted flex items-center gap-1">
                            <IoShieldCheckmarkOutline size={12} />
                            {roleLabel(person.role)}
                            {person.is_online ? " · online" : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                  Members ({others.length || members.length})
                </p>
                <ul className="space-y-3">
                  {(others.length ? others : members).map((person) => (
                    <li key={person.id} className="flex items-center gap-3">
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{displayName(person)}</p>
                        <p className="text-xs text-muted truncate">
                          @{person.username || "member"}
                          {person.role && person.role !== "member"
                            ? ` · ${roleLabel(person.role)}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ChatGroupInfo;
