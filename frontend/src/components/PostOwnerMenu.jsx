import { useEffect, useRef, useState } from "react";
import {
  IoChatboxEllipsesOutline,
  IoCreateOutline,
  IoEllipsisHorizontal,
  IoEyeOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { isOwnContent } from "../utils/postOwnership";

/**
 * ··· menu for post/comment owners: view, edit, delete.
 */
export default function PostOwnerMenu({
  item,
  itemType = "post",
  onViewDetails,
  onViewComments,
  onEdit,
  onDeleted,
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);
  const own = isOwnContent(item);
  const label = itemType === "comments" ? "Comment" : "Post";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete ${label}?\n\nThis cannot be undone.`
    );
    if (!confirmed || !item?.id) return;
    setDeleting(true);
    try {
      const url =
        itemType === "comments"
          ? `${endpoints.comments}${item.id}/`
          : `${endpoints.post}${item.id}/`;
      await client.run("delete", url, {}, true);
      toast.success(`${label} deleted`);
      setOpen(false);
      onDeleted?.(item);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : `Could not delete ${label.toLowerCase()}.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-surface-muted transition-colors"
        style={{ borderRadius: 5 }}
        aria-label={`${label} options`}
        aria-expanded={open}
      >
        <IoEllipsisHorizontal className="w-5 h-5 text-muted" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-10 z-50 min-w-[180px] border border-border bg-surface py-1 shadow-lg"
          style={{ borderRadius: 5 }}
          role="menu"
        >
          {onViewDetails ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-muted inline-flex items-center gap-2"
              onClick={() => {
                onViewDetails(item);
                setOpen(false);
              }}
            >
              <IoEyeOutline className="text-primary" size={16} />
              View details
            </button>
          ) : null}
          {onViewComments ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-muted inline-flex items-center gap-2"
              onClick={() => {
                onViewComments(item);
                setOpen(false);
              }}
            >
              <IoChatboxEllipsesOutline className="text-primary" size={16} />
              View comments
            </button>
          ) : null}
          {own && onEdit ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-muted inline-flex items-center gap-2"
              onClick={() => {
                onEdit(item);
                setOpen(false);
              }}
            >
              <IoCreateOutline className="text-primary" size={16} />
              Edit {label.toLowerCase()}
            </button>
          ) : null}
          {own ? (
            <>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                role="menuitem"
                disabled={deleting}
                className="w-full px-3 py-2.5 text-left text-sm text-destructive hover:bg-surface-muted inline-flex items-center gap-2 disabled:opacity-60"
                onClick={handleDelete}
              >
                <IoTrashOutline size={16} />
                {deleting ? "Deleting…" : `Delete ${label.toLowerCase()}`}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
