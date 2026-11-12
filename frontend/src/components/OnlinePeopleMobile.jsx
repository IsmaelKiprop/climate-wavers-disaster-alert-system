import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { IoPeopleOutline, IoClose } from "react-icons/io5";
import OnlinePeople from "./OnlinePeople";
import { useOnlineUsers } from "../hooks/useOnlineUsers";

/**
 * Mobile/tablet entry: floating contacts button + bottom sheet.
 * Hidden from xl up where the right rail already shows Contacts.
 */
const OnlinePeopleMobile = () => {
  const [open, setOpen] = useState(false);
  const { data } = useOnlineUsers();
  const count = data?.count ?? 0;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 inline-flex items-center gap-2 h-11 px-3.5 bg-surface border border-border text-foreground shadow-sm hover:border-primary right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-4"
        style={{ borderRadius: 5 }}
        aria-label={`Online contacts${count ? `, ${count} online` : ""}`}
      >
        <span className="relative">
          <IoPeopleOutline size={20} aria-hidden="true" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-sm font-medium tabular-nums">{count}</span>
      </button>

      {open
        ? ReactDOM.createPortal(
            <div className="fixed inset-0 z-[90] xl:hidden" role="dialog" aria-modal="true" aria-label="Online contacts">
              <button
                type="button"
                className="absolute inset-0 bg-black/50 border-0"
                aria-label="Close contacts"
                onClick={() => setOpen(false)}
              />
              <div
                className="absolute inset-x-0 bottom-0 max-h-[85dvh] bg-surface border-t border-border flex flex-col"
                style={{
                  borderTopLeftRadius: 5,
                  borderTopRightRadius: 5,
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
                }}
              >
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className="absolute top-2 right-2 z-10 p-2 hover:bg-background"
                    style={{ borderRadius: 5 }}
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                  >
                    <IoClose size={20} />
                  </button>
                  <div className="pt-2 flex justify-center" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-border" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden" style={{ minHeight: "55dvh" }}>
                  <OnlinePeople variant="sheet" onNavigate={() => setOpen(false)} />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default OnlinePeopleMobile;
