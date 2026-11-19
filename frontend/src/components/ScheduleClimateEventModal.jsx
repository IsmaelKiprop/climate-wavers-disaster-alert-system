import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose, IoMailOutline, IoPersonAddOutline, IoTrashOutline } from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser } from "../utils/factory";

const defaultStartsLocal = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toLocalInput = (value) => {
  if (!value) return defaultStartsLocal();
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return defaultStartsLocal();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emailOk = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const ScheduleClimateEventModal = ({
  open,
  onClose,
  mode = "manual", // manual | disaster | project | edit | invite_only
  event = null,
  eventType = null,
  disasterId = null,
  projectId = null,
  responderOrgId = null,
  treeAdminOrgId = null,
  defaultTitle = "",
  defaultDescription = "",
  defaultStartsAt = null,
  /** When false (co-host inviting), only Attendee role is offered. */
  allowCohostRole = true,
  onCreated,
  onUpdated,
}) => {
  const me = getUser();
  const isEdit = mode === "edit" || Boolean(event?.id);
  const inviteOnly = mode === "invite_only";

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(defaultStartsAt));
  const [visibility, setVisibility] = useState(
    mode === "project" ? "public" : mode === "disaster" ? "org" : "invitees"
  );
  const [saving, setSaving] = useState(false);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [invitees, setInvitees] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [treeProjectId, setTreeProjectId] = useState(
    projectId ? String(projectId) : ""
  );
  const [projectOptions, setProjectOptions] = useState([]);
  const [allowTreeGifts, setAllowTreeGifts] = useState(true);

  useEffect(() => {
    if (!open) return;
    if ((isEdit || inviteOnly) && event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      setStartsAt(toLocalInput(event.starts_at));
      setVisibility(event.visibility || "invitees");
      setTreeProjectId(
        event.tree_project != null ? String(event.tree_project) : ""
      );
      setAllowTreeGifts(event.allow_tree_gifts !== false);
      const existing = (event.invites || [])
        .filter((inv) => inv.user !== me?.id && inv.role !== "host")
        .map((inv) => ({
          key: inv.user ? `u-${inv.user}` : `e-${inv.email}`,
          userId: inv.user || null,
          email: inv.email || "",
          label: inv.user_name || inv.username || inv.email || "Invitee",
          role: inv.role === "cohost" ? "cohost" : "attendee",
          initialRole: inv.role === "cohost" ? "cohost" : "attendee",
          existing: true,
        }));
      setInvitees(inviteOnly ? [] : existing);
    } else {
      setTitle(defaultTitle || "");
      setDescription(defaultDescription || "");
      setStartsAt(toLocalInput(defaultStartsAt));
      setVisibility(
        mode === "project" ? "public" : mode === "disaster" ? "org" : "invitees"
      );
      setTreeProjectId(projectId ? String(projectId) : "");
      setAllowTreeGifts(true);
      setInvitees([]);
    }
    setNotifyInApp(true);
    setNotifyEmail(true);
    setSearchQ("");
    setSearchResults([]);
    setEmailDraft("");
  }, [
    open,
    isEdit,
    inviteOnly,
    event,
    defaultTitle,
    defaultDescription,
    defaultStartsAt,
    mode,
    me?.id,
    projectId,
  ]);

  useEffect(() => {
    if (!open || inviteOnly) return;
    let alive = true;
    client
      .run("get", endpoints.tree_projects_african, {}, false)
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        setProjectOptions(list);
      })
      .catch(() => {
        if (alive) setProjectOptions([]);
      });
    return () => {
      alive = false;
    };
  }, [open, inviteOnly]);

  useEffect(() => {
    if (!open) return;
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await client.run(
          "get",
          `${endpoints.searchUsers}?q=${encodeURIComponent(q)}`,
          {},
          true
        );
        const list = (Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [])
          .filter((u) => u?.id != null)
          .filter((u) => !me?.id || String(u.id) !== String(me.id))
          .slice(0, 8);
        if (alive) setSearchResults(list);
      } catch {
        if (alive) setSearchResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 280);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [searchQ, open, me?.id]);

  const heading = useMemo(() => {
    if (inviteOnly) return "Invite people";
    if (isEdit) return "Edit Climate event";
    if (mode === "disaster") return "Schedule disaster briefing";
    if (mode === "project") return "Schedule planting day";
    return "Schedule Climate event";
  }, [mode, isEdit, inviteOnly]);

  const addUserInvitee = (user) => {
    if (!user?.id) return;
    const key = `u-${user.id}`;
    if (invitees.some((i) => i.key === key)) {
      toast.info("Already invited");
      return;
    }
    const label =
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.display_name ||
      user.username ||
      user.email ||
      `User ${user.id}`;
    setInvitees((prev) => [
      ...prev,
      {
        key,
        userId: user.id,
        email: user.email || "",
        label,
        role: "attendee",
        initialRole: null,
        existing: false,
      },
    ]);
    setSearchQ("");
    setSearchResults([]);
  };

  const addEmailInvitee = () => {
    const email = emailDraft.trim().toLowerCase();
    if (!emailOk(email)) {
      toast.error("Enter a valid email");
      return;
    }
    const key = `e-${email}`;
    if (invitees.some((i) => i.key === key || i.email?.toLowerCase() === email)) {
      toast.info("Already invited");
      return;
    }
    setInvitees((prev) => [
      ...prev,
      {
        key,
        userId: null,
        email,
        label: email,
        role: "attendee",
        initialRole: null,
        existing: false,
      },
    ]);
    setEmailDraft("");
  };

  const removeInvitee = (key) => {
    setInvitees((prev) => prev.filter((i) => i.key !== key));
  };

  const setInviteeRole = (key, role) => {
    const next = role === "cohost" && allowCohostRole ? "cohost" : "attendee";
    setInvitees((prev) =>
      prev.map((i) => (i.key === key ? { ...i, role: next } : i))
    );
  };

  if (!open || typeof document === "undefined") return null;

  const buildInviteList = () => {
    let list = [...invitees];
    const draft = emailDraft.trim().toLowerCase();
    if (
      emailOk(draft) &&
      !list.some((i) => i.key === `e-${draft}` || i.email?.toLowerCase() === draft)
    ) {
      list = [
        ...list,
        {
          key: `e-${draft}`,
          userId: null,
          email: draft,
          label: draft,
          role: "attendee",
          initialRole: null,
          existing: false,
        },
      ];
    }
    return list;
  };

  /** People who need an invite API call (new, or role promotion to cohost). */
  const pendingInviteRows = (list) =>
    list.filter(
      (i) =>
        !i.existing ||
        (allowCohostRole &&
          i.role === "cohost" &&
          i.initialRole !== "cohost")
    );

  const splitByRole = (rows) => {
    const attendees = rows.filter((i) => i.role !== "cohost");
    const cohosts = allowCohostRole
      ? rows.filter((i) => i.role === "cohost")
      : [];
    const pack = (group) => ({
      invite_user_ids: group
        .filter((i) => i.userId != null && i.userId !== "")
        .map((i) => Number(i.userId))
        .filter((id) => Number.isFinite(id) && id > 0),
      invite_emails: group
        .filter((i) => (i.userId == null || i.userId === "") && i.email)
        .map((i) => String(i.email).trim().toLowerCase()),
    });
    return { attendees: pack(attendees), cohosts: pack(cohosts) };
  };

  const pushInviteBatch = async (eventId, batch, role) => {
    const hasUsers = (batch.invite_user_ids || []).length > 0;
    const hasEmails = (batch.invite_emails || []).length > 0;
    if (!eventId || (!hasUsers && !hasEmails)) return null;
    return client.run(
      "post",
      `${endpoints.climateEvents}${eventId}/invite/`,
      {
        invite_user_ids: batch.invite_user_ids,
        invite_emails: batch.invite_emails,
        role,
        notify_in_app: notifyInApp,
        notify_email: notifyEmail,
      },
      true
    );
  };

  const pushInvitesByRole = async (eventId, list) => {
    const pending = pendingInviteRows(list);
    const { attendees, cohosts } = splitByRole(pending);
    const results = [];
    const a = await pushInviteBatch(eventId, attendees, "attendee");
    if (a) results.push(a);
    const c = await pushInviteBatch(eventId, cohosts, "cohost");
    if (c) results.push(c);
    return results;
  };

  const countPending = (list) => pendingInviteRows(list).length;

  const submit = async (e) => {
    e.preventDefault();
    if (!inviteOnly && !title.trim()) {
      toast.error("Add a title");
      return;
    }
    setSaving(true);
    try {
      const list = buildInviteList();
      const newCount = countPending(list);
      let data;

      if (inviteOnly && event?.id) {
        if (newCount === 0) {
          toast.info("Add someone to invite");
          setSaving(false);
          return;
        }
        await pushInvitesByRole(event.id, list);
        try {
          data = await client.run(
            "get",
            `${endpoints.climateEvents}${event.id}/`,
            {},
            true
          );
        } catch {
          data = event;
        }
        toast.success(
          `${newCount} invite${newCount === 1 ? "" : "s"} sent`
        );
        onUpdated?.(data);
        onClose?.();
        return;
      }

      const startsIso = new Date(startsAt).toISOString();
      const treeFields = {
        allow_tree_gifts: allowTreeGifts,
        tree_project: treeProjectId ? Number(treeProjectId) : null,
      };

      if (isEdit && event?.id) {
        data = await client.run(
          "patch",
          `${endpoints.climateEvents}${event.id}/`,
          {
            title: title.trim(),
            description: description.trim(),
            starts_at: startsIso,
            visibility,
            ...treeFields,
          },
          true
        );
        if (newCount > 0) {
          await pushInvitesByRole(event.id, list);
          try {
            data = await client.run(
              "get",
              `${endpoints.climateEvents}${event.id}/`,
              {},
              true
            );
          } catch {
            /* keep patch payload */
          }
        }
        toast.success(
          newCount > 0
            ? `Event updated · ${newCount} invite${newCount === 1 ? "" : "s"} sent`
            : "Event updated"
        );
        onUpdated?.(data);
      } else {
        const createBodyBase = {
          title: title.trim(),
          description: description.trim(),
          starts_at: startsIso,
          visibility,
          ...treeFields,
        };

        if (mode === "disaster" && disasterId) {
          data = await client.run(
            "post",
            endpoints.climateEventFromDisaster,
            {
              disaster_id: disasterId,
              responder_org: responderOrgId || undefined,
              ...createBodyBase,
            },
            true
          );
        } else if (mode === "project" && projectId) {
          data = await client.run(
            "post",
            endpoints.climateEventFromProject,
            {
              project_id: projectId,
              tree_admin_org: treeAdminOrgId || undefined,
              ...createBodyBase,
            },
            true
          );
        } else {
          const resolvedType =
            eventType ||
            (mode === "disaster"
              ? "disaster_briefing"
              : mode === "project"
                ? "planting_day"
                : "huddle");
          data = await client.run(
            "post",
            endpoints.climateEvents,
            {
              ...createBodyBase,
              event_type: resolvedType,
              disaster: disasterId || undefined,
              tree_project: treeProjectId
                ? Number(treeProjectId)
                : projectId || undefined,
              responder_org: responderOrgId || undefined,
              tree_admin_org: treeAdminOrgId || undefined,
            },
            true
          );
        }

        if (data?.id && newCount > 0) {
          await pushInvitesByRole(data.id, list);
          try {
            data = await client.run(
              "get",
              `${endpoints.climateEvents}${data.id}/`,
              {},
              true
            );
          } catch {
            /* keep create payload */
          }
        }

        toast.success(
          newCount > 0
            ? `Scheduled · ${newCount} invite${newCount === 1 ? "" : "s"} sent`
            : "Climate event scheduled"
        );
        onCreated?.(data);
      }
      onClose?.();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          (inviteOnly
            ? "Could not send invites"
            : isEdit
              ? "Could not update event"
              : "Could not schedule event")
      );
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <form
        className="w-full sm:max-w-md border border-border max-h-[88dvh] overflow-y-auto"
        style={{
          background: "var(--cw-surface-elevated)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">{heading}</h3>
            <p className="text-xs text-muted">
              {allowCohostRole
                ? "Invite collaborators as attendees or co-hosts"
                : "Invite attendees to this event"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </header>
        <div className="p-4 space-y-3">
          {!inviteOnly ? (
            <>
              <label className="block text-xs font-medium text-muted">
                Title
                <input
                  className="mt-1 w-full h-11 px-3 border border-border bg-background text-foreground text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Starts
                <input
                  type="datetime-local"
                  className="mt-1 w-full h-11 px-3 border border-border bg-background text-foreground text-sm"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Visibility
                <select
                  className="mt-1 w-full h-11 px-3 border border-border bg-background text-foreground text-sm"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="invitees">Invitees only</option>
                  <option value="org">Organization</option>
                  <option value="public">Public</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-muted">
                Description
                <textarea
                  className="mt-1 w-full min-h-[72px] px-3 py-2 border border-border bg-background text-foreground text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="border border-border bg-background p-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Trees for this day’s activities
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Attach a planting project so invitees and anyone can buy available
                    species for this day
                  </p>
                </div>
                <label className="block text-xs font-medium text-muted">
                  Day tree project
                  <select
                    className="mt-1 w-full h-11 px-3 border border-border bg-surface text-foreground text-sm"
                    value={treeProjectId}
                    onChange={(e) => setTreeProjectId(e.target.value)}
                  >
                    <option value="">Any verified Climate Wavers project</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.city ? ` · ${p.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={allowTreeGifts}
                    onChange={(e) => setAllowTreeGifts(e.target.checked)}
                  />
                  Allow buying / gifting trees for this day
                </label>
              </div>
            </>
          ) : null}

          <div className="border border-border bg-background p-3 space-y-3">
            <div>
              <p className="text-xs font-medium text-foreground inline-flex items-center gap-1.5">
                <IoPersonAddOutline size={14} />
                {allowCohostRole ? "Invite collaborators" : "Invite attendees"}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Search Climate Wavers members or add an email
                {allowCohostRole
                  ? " — set each person as Attendee or Co-host"
                  : ""}
              </p>
            </div>

            <div className="relative">
              <input
                className="w-full h-10 px-3 border border-border bg-surface text-foreground text-sm"
                placeholder="Search people…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
              {searchQ.trim().length >= 2 ? (
                <div className="absolute z-10 left-0 right-0 mt-1 border border-border bg-surface max-h-40 overflow-y-auto">
                  {searching ? (
                    <p className="px-3 py-2 text-xs text-muted">Searching…</p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted">No members found</p>
                  ) : (
                    searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addUserInvitee(u)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-[var(--cw-overlay-soft)] border-b border-border last:border-0"
                      >
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                          u.username}
                        {u.email ? (
                          <span className="block text-[11px] text-muted">{u.email}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 h-10 px-3 border border-border bg-surface text-foreground text-sm"
                placeholder="Invite by email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmailInvitee();
                  }
                }}
              />
              <button
                type="button"
                onClick={addEmailInvitee}
                className="h-10 px-3 border border-border text-sm text-foreground inline-flex items-center gap-1.5 hover:bg-[var(--cw-overlay-soft)]"
              >
                <IoMailOutline size={16} />
                Add
              </button>
            </div>

            {invitees.length > 0 ? (
              <ul className="space-y-1.5">
                {invitees.map((inv) => (
                  <li
                    key={inv.key}
                    className="flex flex-col gap-1.5 border border-border px-2.5 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate text-foreground">
                        {inv.label}
                        {inv.existing ? (
                          <span className="text-[10px] text-muted ml-1">· invited</span>
                        ) : inv.userId ? (
                          <span className="text-[10px] text-muted ml-1">· in-app</span>
                        ) : (
                          <span className="text-[10px] text-muted ml-1">· email</span>
                        )}
                      </span>
                      {!inv.existing ? (
                        <button
                          type="button"
                          onClick={() => removeInvitee(inv.key)}
                          className="text-muted hover:text-foreground"
                          aria-label="Remove invitee"
                        >
                          <IoTrashOutline size={16} />
                        </button>
                      ) : null}
                    </div>
                    {allowCohostRole ? (
                      <div
                        className="inline-flex border border-border self-start"
                        role="group"
                        aria-label={`Role for ${inv.label}`}
                      >
                        <button
                          type="button"
                          onClick={() => setInviteeRole(inv.key, "attendee")}
                          className={`h-7 px-2.5 text-[11px] font-medium ${
                            inv.role !== "cohost"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Attendee
                        </button>
                        <button
                          type="button"
                          onClick={() => setInviteeRole(inv.key, "cohost")}
                          className={`h-7 px-2.5 text-[11px] font-medium border-l border-border ${
                            inv.role === "cohost"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Co-host
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted">Attendee</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No invitees yet</p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={notifyInApp}
                  onChange={(e) => setNotifyInApp(e.target.checked)}
                />
                Send Climate Wavers in-app notification
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                />
                Send invite email
              </label>
            </div>
          </div>
        </div>
        <footer className="p-4 border-t border-border grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 border border-border text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {saving
              ? "Saving…"
              : inviteOnly
                ? "Send invites"
                : isEdit
                  ? "Save changes"
                  : "Schedule"}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
};

export default ScheduleClimateEventModal;
