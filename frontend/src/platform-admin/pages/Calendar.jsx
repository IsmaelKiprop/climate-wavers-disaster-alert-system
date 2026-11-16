import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminTable,
  ConfirmAction,
  FilterButton,
  PageHeader,
  StatusBadge,
  statusTone,
} from "../shared";

const Calendar = () => {
  const [tab, setTab] = useState("events");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [reminding, setReminding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "events") {
        const data = await client.run(
          "get",
          `${endpoints.platformAdminEvents}?limit=40`,
          {},
          true
        );
        setRows(data?.results || []);
      } else {
        const data = await client.run(
          "get",
          `${endpoints.platformAdminObservances}?limit=50`,
          {},
          true
        );
        setRows(data?.results || []);
      }
    } catch {
      toast.error("Could not load calendar data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const setEventStatus = async (id, status) => {
    setBusyId(id);
    try {
      await client.run("patch", endpoints.platformAdminEvent(id), { status }, true);
      toast.success("Event updated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggleObservance = async (id, is_active) => {
    setBusyId(id);
    try {
      await client.run(
        "patch",
        endpoints.platformAdminObservances,
        { id, is_active },
        true
      );
      toast.success("Observance updated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const sendReminders = async () => {
    setReminding(true);
    try {
      await client.run("post", endpoints.calendarSendReminders, {}, true);
      toast.success("Reminders triggered");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not send reminders");
    } finally {
      setReminding(false);
    }
  };

  const eventColumns = [
    {
      key: "title",
      label: "Event",
      render: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted">
            {r.event_type} · {r.starts_at ? new Date(r.starts_at).toLocaleString() : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge value={r.status} tone={statusTone(r.status)} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.status !== "cancelled" ? (
            <ConfirmAction
              label="Cancel"
              variant="danger"
              busy={busyId === r.id}
              onConfirm={() => setEventStatus(r.id, "cancelled")}
            />
          ) : null}
          {r.status === "scheduled" ? (
            <ConfirmAction
              label="Mark live"
              variant="ghost"
              busy={busyId === r.id}
              onConfirm={() => setEventStatus(r.id, "live")}
            />
          ) : null}
          {r.status === "live" ? (
            <ConfirmAction
              label="End"
              busy={busyId === r.id}
              onConfirm={() => setEventStatus(r.id, "ended")}
            />
          ) : null}
        </div>
      ),
    },
  ];

  const observanceColumns = [
    {
      key: "title",
      label: "Observance",
      render: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted">
            {r.month}/{r.day} · {r.category}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Active",
      render: (r) => (
        <StatusBadge value={r.is_active ? "active" : "off"} tone={r.is_active ? "ok" : "neutral"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <ConfirmAction
          label={r.is_active ? "Disable" : "Enable"}
          variant="ghost"
          busy={busyId === r.id}
          onConfirm={() => toggleObservance(r.id, !r.is_active)}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Climate events and observances"
        actions={
          <FilterButton type="button" disabled={reminding} onClick={sendReminders}>
            {reminding ? "Sending…" : "Send reminders"}
          </FilterButton>
        }
      />
      <div className="flex gap-2 mb-4">
        {[
          ["events", "Events"],
          ["observances", "Observances"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-9 px-3 text-sm border ${
              tab === id ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <AdminTable
        columns={tab === "events" ? eventColumns : observanceColumns}
        rows={rows}
        empty={loading ? "Loading…" : "No rows"}
      />
    </div>
  );
};

export default Calendar;
