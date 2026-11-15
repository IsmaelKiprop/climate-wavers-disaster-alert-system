import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

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

const ScheduleClimateEventModal = ({
  open,
  onClose,
  mode = "manual", // manual | disaster | project
  eventType = null,
  disasterId = null,
  projectId = null,
  responderOrgId = null,
  treeAdminOrgId = null,
  defaultTitle = "",
  defaultDescription = "",
  defaultStartsAt = null,
  onCreated,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(defaultStartsAt));
  const [visibility, setVisibility] = useState(
    mode === "project" ? "public" : mode === "disaster" ? "org" : "invitees"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle || "");
    setDescription(defaultDescription || "");
    setStartsAt(toLocalInput(defaultStartsAt));
  }, [open, defaultTitle, defaultDescription, defaultStartsAt]);

  const heading = useMemo(() => {
    if (mode === "disaster") return "Schedule disaster briefing";
    if (mode === "project") return "Schedule planting day";
    return "Schedule Climate event";
  }, [mode]);

  if (!open || typeof document === "undefined") return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Add a title");
      return;
    }
    setSaving(true);
    try {
      const startsIso = new Date(startsAt).toISOString();
      let data;
      if (mode === "disaster" && disasterId) {
        data = await client.run(
          "post",
          endpoints.climateEventFromDisaster,
          {
            disaster_id: disasterId,
            title: title.trim(),
            description: description.trim(),
            starts_at: startsIso,
            visibility,
            responder_org: responderOrgId || undefined,
          },
          true
        );
      } else if (mode === "project" && projectId) {
        data = await client.run(
          "post",
          endpoints.climateEventFromProject,
          {
            project_id: projectId,
            title: title.trim(),
            description: description.trim(),
            starts_at: startsIso,
            visibility,
            tree_admin_org: treeAdminOrgId || undefined,
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
            title: title.trim(),
            description: description.trim(),
            event_type: resolvedType,
            starts_at: startsIso,
            visibility,
            disaster: disasterId || undefined,
            tree_project: projectId || undefined,
            responder_org: responderOrgId || undefined,
            tree_admin_org: treeAdminOrgId || undefined,
          },
          true
        );
      }
      toast.success("Climate event scheduled");
      onCreated?.(data);
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not schedule event");
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
            <p className="text-xs text-muted">Opens a Climate Wavers Jitsi room</p>
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
              className="mt-1 w-full min-h-[88px] px-3 py-2 border border-border bg-background text-foreground text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
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
            {saving ? "Saving…" : "Schedule"}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
};

export default ScheduleClimateEventModal;
