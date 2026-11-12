import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";

const emptyForm = { name: "", description: "" };

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.run("get", endpoints.groups, {}, true, false, false, false);
      setGroups(data?.groups || []);
    } catch {
      toast.error("Could not load groups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createGroup = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    setCreating(true);
    try {
      await client.run("post", endpoints.groups, form, true);
      setForm(emptyForm);
      toast.success("Group created.");
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not create group.";
      toast.error(typeof detail === "string" ? detail : "Could not create group.");
    } finally {
      setCreating(false);
    }
  };

  const joinGroup = async (groupId) => {
    setBusy(true);
    try {
      await client.run("post", `${endpoints.groups}${groupId}/join/`, {}, true);
      toast.success("Joined group.");
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not join group.";
      toast.error(typeof detail === "string" ? detail : "Could not join group.");
    } finally {
      setBusy(false);
    }
  };

  const leaveGroup = async (groupId) => {
    setBusy(true);
    try {
      await client.run("post", `${endpoints.groups}${groupId}/leave/`, {}, true);
      toast.success("Left group.");
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not leave group.";
      toast.error(typeof detail === "string" ? detail : "Could not leave group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Groups</h1>
      <p className="mt-1 text-sm text-muted">
        Join climate and disaster-response communities, or start your own.
      </p>

      <form onSubmit={createGroup} className="mt-6 border border-border bg-surface p-4 space-y-3">
        <h2 className="text-base font-semibold">Create a group</h2>
        <label className="block text-sm">
          <span className="font-medium">Name</span>
          <input
            className="mt-1 h-11 w-full px-3 border border-border bg-background"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            minLength={3}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Description</span>
          <textarea
            className="mt-1 w-full min-h-[80px] px-3 py-2 border border-border bg-background"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="min-h-11 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create group"}
        </button>
      </form>

      <div className="mt-6 border border-border bg-surface divide-y divide-border">
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading groups…</p>
        ) : !groups.length ? (
          <p className="p-4 text-sm text-muted">No groups yet. Create the first one.</p>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium">{group.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {group.description || "No description"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {group.member_count || 0} members
                  {group.my_role ? ` · you are ${group.my_role}` : ""}
                </p>
              </div>
              {group.is_member ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => leaveGroup(group.id)}
                  className="min-h-10 px-3 text-sm border border-border bg-background disabled:opacity-60"
                >
                  Leave
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => joinGroup(group.id)}
                  className="min-h-10 px-3 text-sm bg-primary text-primary-foreground disabled:opacity-60"
                >
                  Join
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Groups;
