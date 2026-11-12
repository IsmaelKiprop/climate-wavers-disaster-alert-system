import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoCamera, IoClose, IoPeopleOutline } from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../../api";
import { uploadFiles } from "../../services/upload.service";
import { endpoints } from "../../utils/endpoints";
import { secureMediaUrl } from "../../utils/factory";

const emptyForm = { name: "", description: "", cover_image: "" };
const DESC_MAX = 512;

const Groups = () => {
  const navigate = useNavigate();
  const createLogoRef = useRef(null);
  const editLogoRef = useRef(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editLogoPreview, setEditLogoPreview] = useState("");
  const [editLogoFile, setEditLogoFile] = useState(null);
  const [editRemoveLogo, setEditRemoveLogo] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      if (editLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(editLogoPreview);
    };
  }, [logoPreview, editLogoPreview]);

  const openGroupChat = (conversationId, groupName) => {
    if (!conversationId) {
      toast.info("Open Chats to find this group room.");
      navigate("/app/chat");
      return;
    }
    toast.success(`${groupName || "Group"} chat is ready.`);
    navigate(`/app/chat?c=${conversationId}`);
  };

  const pickLogoFile = (file, { setFile, setPreview, currentPreview, onReady }) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image for the group logo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB.");
      return;
    }
    if (currentPreview?.startsWith("blob:")) URL.revokeObjectURL(currentPreview);
    setFile(file);
    setPreview(URL.createObjectURL(file));
    onReady?.();
  };

  const clearCreateLogo = () => {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview("");
    setForm((p) => ({ ...p, cover_image: "" }));
  };

  const createGroup = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    setCreating(true);
    try {
      let cover_image = form.cover_image || "";
      if (logoFile) {
        const uploaded = await uploadFiles(logoFile);
        cover_image = Array.isArray(uploaded) ? uploaded[0] : uploaded;
        if (!cover_image) {
          toast.error("Could not upload group logo.");
          return;
        }
      }
      const payload = {
        name: form.name.trim(),
        description: form.description.trim().slice(0, DESC_MAX),
        cover_image: cover_image || undefined,
        logo: cover_image || undefined,
      };
      const data = await client.run("post", endpoints.groups, payload, true);
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoFile(null);
      setLogoPreview("");
      setForm(emptyForm);
      await load();
      openGroupChat(data?.conversation_id || data?.conversation?.id, data?.name || form.name);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not create group.";
      toast.error(typeof detail === "string" ? detail : "Could not create group.");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (group) => {
    if (editLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(editLogoPreview);
    setEditingGroup(group);
    setEditForm({
      name: group.name || "",
      description: group.description || "",
      cover_image: group.cover_image || "",
    });
    setEditLogoFile(null);
    setEditLogoPreview(secureMediaUrl(group.cover_image, ""));
    setEditRemoveLogo(false);
  };

  const closeEdit = () => {
    if (editLogoPreview?.startsWith("blob:") && editLogoFile) {
      URL.revokeObjectURL(editLogoPreview);
    }
    setEditingGroup(null);
    setEditForm(emptyForm);
    setEditLogoFile(null);
    setEditLogoPreview("");
    setEditRemoveLogo(false);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingGroup) return;
    if (!editForm.name.trim() || editForm.name.trim().length < 3) {
      toast.error("Group name must be at least 3 characters.");
      return;
    }
    setSavingEdit(true);
    try {
      let cover_image = editForm.cover_image || "";
      if (editRemoveLogo && !editLogoFile) {
        cover_image = "";
      }
      if (editLogoFile) {
        const uploaded = await uploadFiles(editLogoFile);
        cover_image = Array.isArray(uploaded) ? uploaded[0] : uploaded;
        if (!cover_image) {
          toast.error("Could not upload group logo.");
          return;
        }
      }
      const payload = {
        name: editForm.name.trim(),
        description: editForm.description.trim().slice(0, DESC_MAX),
        cover_image,
        logo: cover_image,
      };
      await client.run("patch", `${endpoints.groups}${editingGroup.id}/`, payload, true);
      toast.success("Group updated.");
      closeEdit();
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not update group.";
      toast.error(typeof detail === "string" ? detail : "Could not update group.");
    } finally {
      setSavingEdit(false);
    }
  };

  const joinGroup = async (groupId) => {
    setBusy(true);
    try {
      const data = await client.run("post", `${endpoints.groups}${groupId}/join/`, {}, true);
      await load();
      openGroupChat(
        data?.conversation_id || data?.conversation?.id,
        data?.group?.name
      );
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
      toast.success("Left group. Chat removed from your list.");
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not leave group.";
      toast.error(typeof detail === "string" ? detail : "Could not leave group.");
    } finally {
      setBusy(false);
    }
  };

  const canEdit = (group) => group?.my_role === "owner" || group?.my_role === "admin";
  const descLen = form.description.length;
  const editDescLen = editForm.description.length;
  const editPreview = editRemoveLogo && !editLogoFile ? "" : editLogoPreview;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Groups</h1>
      <p className="mt-1 text-sm text-muted">
        Join a climate community. Membership automatically adds a group chat under{" "}
        <Link to="/app/chat" className="text-primary">
          Chats
        </Link>
        .
      </p>

      <form onSubmit={createGroup} className="mt-6 border border-border bg-surface p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold">Create a group</h2>

        <div className="flex flex-col items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => createLogoRef.current?.click()}
            className="relative h-24 w-24 rounded-full bg-background border border-border overflow-hidden flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Add group logo"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <IoPeopleOutline size={36} className="text-muted" />
            )}
            <span className="absolute inset-x-0 bottom-0 h-8 bg-foreground/55 text-background flex items-center justify-center">
              <IoCamera size={16} />
            </span>
          </button>
          <input
            ref={createLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickLogoFile(e.target.files?.[0], {
                setFile: setLogoFile,
                setPreview: setLogoPreview,
                currentPreview: logoPreview,
              });
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => createLogoRef.current?.click()}
              className="text-primary font-medium"
            >
              {logoPreview ? "Change logo" : "Add group logo"}
            </button>
            {logoPreview ? (
              <button type="button" onClick={clearCreateLogo} className="text-muted">
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Group name</span>
          <input
            className="mt-1 h-11 w-full px-3 border border-border bg-background"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            minLength={3}
            maxLength={120}
            placeholder="e.g. Eldoret Flood Watch"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Short description</span>
          <textarea
            className="mt-1 w-full min-h-[88px] px-3 py-2 border border-border bg-background resize-y"
            value={form.description}
            maxLength={DESC_MAX}
            placeholder="What this group is for — visible to members"
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value.slice(0, DESC_MAX) }))
            }
          />
          <span className="mt-1 flex justify-end text-xs text-muted">
            {descLen}/{DESC_MAX}
          </span>
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
          groups.map((group) => {
            const logo = secureMediaUrl(group.cover_image, "");
            return (
              <div key={group.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className="shrink-0 h-12 w-12 rounded-full overflow-hidden bg-background border border-border flex items-center justify-center">
                    {logo ? (
                      <img src={logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <IoPeopleOutline size={22} className="text-muted" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-medium">{group.name}</h3>
                    <p className="mt-1 text-sm text-muted line-clamp-2">
                      {group.description || "No description"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {group.member_count || 0} members
                      {group.my_role ? ` · you are ${group.my_role}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit(group) ? (
                    <button
                      type="button"
                      disabled={busy || savingEdit}
                      onClick={() => openEdit(group)}
                      className="min-h-10 px-3 text-sm border border-border bg-background disabled:opacity-60"
                    >
                      Edit
                    </button>
                  ) : null}
                  {group.is_member ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          openGroupChat(group.conversation_id, group.name)
                        }
                        className="min-h-10 px-3 text-sm bg-primary text-primary-foreground disabled:opacity-60"
                      >
                        Open chat
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => leaveGroup(group.id)}
                        className="min-h-10 px-3 text-sm border border-border bg-background disabled:opacity-60"
                      >
                        Leave
                      </button>
                    </>
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
              </div>
            );
          })
        )}
      </div>

      {editingGroup ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-foreground/30 p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close edit group"
            onClick={closeEdit}
          />
          <form
            onSubmit={saveEdit}
            className="relative z-10 w-full max-w-lg max-h-[92dvh] overflow-y-auto border border-border bg-surface p-4 sm:p-5 space-y-4 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-group-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="edit-group-title" className="text-base font-semibold">
                Edit group
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                className="min-h-10 min-w-10 flex items-center justify-center text-muted"
                aria-label="Close"
              >
                <IoClose size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => editLogoRef.current?.click()}
                className="relative h-24 w-24 rounded-full bg-background border border-border overflow-hidden flex items-center justify-center"
                aria-label="Change group logo"
              >
                {editPreview ? (
                  <img src={editPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IoPeopleOutline size={36} className="text-muted" />
                )}
                <span className="absolute inset-x-0 bottom-0 h-8 bg-foreground/55 text-background flex items-center justify-center">
                  <IoCamera size={16} />
                </span>
              </button>
              <input
                ref={editLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickLogoFile(e.target.files?.[0], {
                    setFile: setEditLogoFile,
                    setPreview: setEditLogoPreview,
                    currentPreview: editLogoPreview,
                    onReady: () => setEditRemoveLogo(false),
                  });
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => editLogoRef.current?.click()}
                  className="text-primary font-medium"
                >
                  {editPreview ? "Change logo" : "Add logo"}
                </button>
                {editPreview || editForm.cover_image ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editLogoPreview?.startsWith("blob:")) {
                        URL.revokeObjectURL(editLogoPreview);
                      }
                      setEditLogoFile(null);
                      setEditLogoPreview("");
                      setEditRemoveLogo(true);
                      setEditForm((p) => ({ ...p, cover_image: "" }));
                    }}
                    className="text-muted"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Group name</span>
              <input
                className="mt-1 h-11 w-full px-3 border border-border bg-background"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                required
                minLength={3}
                maxLength={120}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Short description</span>
              <textarea
                className="mt-1 w-full min-h-[88px] px-3 py-2 border border-border bg-background resize-y"
                value={editForm.description}
                maxLength={DESC_MAX}
                placeholder="Add a short description if you skipped it earlier"
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    description: e.target.value.slice(0, DESC_MAX),
                  }))
                }
              />
              <span className="mt-1 flex justify-end text-xs text-muted">
                {editDescLen}/{DESC_MAX}
              </span>
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-11 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                className="min-h-11 px-4 border border-border text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default Groups;
