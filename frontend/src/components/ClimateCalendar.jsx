import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IoAdd,
  IoCalendarOutline,
  IoCallOutline,
  IoChevronBack,
  IoLeafOutline,
  IoRadioButtonOn,
  IoWarningOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { unwrapList } from "../utils/apiData";
import JitsiMeetEmbed from "./JitsiMeetEmbed";
import ScheduleClimateEventModal from "./ScheduleClimateEventModal";
import { env } from "../config/env";

const TYPE_LABEL = {
  disaster_briefing: "Disaster briefing",
  planting_day: "Planting day",
  huddle: "Climate huddle",
};

function formatWhen(iso, timezone) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function EventTypeIcon({ type }) {
  if (type === "disaster_briefing") return <IoWarningOutline className="text-amber-600" />;
  if (type === "planting_day") return <IoLeafOutline className="text-primary" />;
  return <IoCallOutline className="text-primary" />;
}

const ClimateCalendar = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const autoJoin = searchParams.get("join") === "1" || Boolean(eventId && window.location.pathname.endsWith("/join"));

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [callSession, setCallSession] = useState(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.run("get", endpoints.climateEventsMine, {}, true);
      setEvents(unwrapList(data));
    } catch {
      setEvents([]);
      toast.error("Could not load Climate calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!eventId || !events.length) return;
    const found = events.find((e) => String(e.id) === String(eventId));
    if (found) setSelected(found);
  }, [eventId, events]);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "mine") {
      return events.filter((e) => e.my_role === "host" || e.my_rsvp === "yes");
    }
    return events.filter((e) => e.event_type === filter);
  }, [events, filter]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...filtered].sort((a, b) => {
      const liveBoost = (x) => (x.status === "live" ? -1 : 0);
      return liveBoost(a) - liveBoost(b) || new Date(a.starts_at) - new Date(b.starts_at) || a.id - b.id;
    }).filter((e) => e.status !== "cancelled" && (e.status === "live" || new Date(e.starts_at).getTime() > now - 6 * 3600 * 1000));
  }, [filtered]);

  const joinEvent = async (event) => {
    if (!event?.id || joining) return;
    setJoining(true);
    try {
      const data = await client.run(
        "post",
        `${endpoints.climateEvents}${event.id}/join/`,
        {},
        true
      );
      setCallSession({
        roomName: data.roomName,
        displayName: data.displayName,
        subject: event.title,
        domain: data.domain || env.jitsiDomain,
        eventId: event.id,
      });
      setSelected((prev) =>
        prev && prev.id === event.id ? { ...prev, status: data.status || prev.status } : prev
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not join Climate room");
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!autoJoin || !selected || callSession) return;
    joinEvent(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, selected?.id]);

  const rsvp = async (choice) => {
    if (!selected?.id) return;
    try {
      await client.run(
        "post",
        `${endpoints.climateEvents}${selected.id}/rsvp/`,
        { rsvp: choice },
        true
      );
      setSelected((s) => (s ? { ...s, my_rsvp: choice } : s));
      setEvents((list) =>
        list.map((e) => (e.id === selected.id ? { ...e, my_rsvp: choice } : e))
      );
      toast.success(`RSVP: ${choice}`);
    } catch {
      toast.error("Could not update RSVP");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        <header className="border border-border bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted inline-flex items-center gap-1.5">
              <IoCalendarOutline />
              Climate Action Calendar
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-0.5">
              Briefings & planting days
            </h1>
            <p className="text-sm text-muted mt-1 max-w-xl">
              Disaster briefings, planting days, and Climate huddles — each with a
              Climate Wavers conference room.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0"
          >
            <IoAdd size={18} />
            New event
          </button>
        </header>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "mine", label: "My calendar" },
            { key: "disaster_briefing", label: "Briefings" },
            { key: "planting_day", label: "Planting" },
            { key: "huddle", label: "Huddles" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`h-9 px-3 text-xs font-medium border ${
                filter === tab.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-[var(--cw-overlay-soft)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <section className="lg:col-span-3 border border-border bg-surface">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Agenda</h2>
            </div>
            {loading ? (
              <p className="p-6 text-sm text-muted">Loading events…</p>
            ) : upcoming.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm text-muted">No upcoming Climate events yet.</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="text-sm text-primary font-medium"
                >
                  Schedule the first one
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(event);
                        navigate(`/app/calendar/events/${event.id}`, { replace: true });
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-[var(--cw-overlay-soft)] ${
                        selected?.id === event.id ? "bg-[var(--cw-overlay-soft)]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-9 w-9 border border-border bg-background inline-flex items-center justify-center shrink-0">
                          <EventTypeIcon type={event.event_type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {event.title}
                            </p>
                            {event.status === "live" ? (
                              <span className="text-[10px] uppercase tracking-wide text-red-600 inline-flex items-center gap-1">
                                <IoRadioButtonOn /> Live
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {TYPE_LABEL[event.event_type] || event.event_type} ·{" "}
                            {formatWhen(event.starts_at, event.timezone)}
                          </p>
                          {event.tree_project_name || event.disaster_title ? (
                            <p className="text-xs text-muted mt-0.5 truncate">
                              {event.tree_project_name || event.disaster_title}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="lg:col-span-2 border border-border bg-surface min-h-[280px]">
            {!selected ? (
              <div className="p-6 text-sm text-muted">
                Select an event to RSVP or join the Climate room.
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted">
                      {TYPE_LABEL[selected.event_type]}
                    </p>
                    <h3 className="text-base font-semibold text-foreground leading-snug">
                      {selected.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="text-muted hover:text-foreground lg:hidden"
                    onClick={() => setSelected(null)}
                    aria-label="Back"
                  >
                    <IoChevronBack size={20} />
                  </button>
                </div>
                <div className="p-4 space-y-3 flex-1">
                  <p className="text-sm text-muted">
                    {formatWhen(selected.starts_at, selected.timezone)}
                    {selected.host_name ? ` · Host ${selected.host_name}` : ""}
                  </p>
                  {selected.description ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selected.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selected.tree_project ? (
                      <Link
                        to={`/p/${selected.tree_project}`}
                        className="border border-border px-2 py-1 text-muted hover:text-foreground"
                      >
                        Tree project
                      </Link>
                    ) : null}
                    {selected.disaster ? (
                      <Link
                        to={`/disasters/${selected.disaster}`}
                        className="border border-border px-2 py-1 text-muted hover:text-foreground"
                      >
                        Disaster
                      </Link>
                    ) : null}
                    <span className="border border-border px-2 py-1 text-muted">
                      {selected.visibility}
                    </span>
                    <span className="border border-border px-2 py-1 text-muted">
                      RSVP: {selected.my_rsvp || "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["yes", "maybe", "no"].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => rsvp(choice)}
                        className={`h-9 px-3 text-xs font-medium border capitalize ${
                          selected.my_rsvp === choice
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground"
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-border space-y-2">
                  <button
                    type="button"
                    disabled={joining || selected.status === "cancelled"}
                    onClick={() => joinEvent(selected)}
                    className="w-full h-11 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <IoCallOutline size={18} />
                    {joining ? "Joining…" : "Join Climate room"}
                  </button>
                  <p className="text-[11px] text-muted text-center">
                    Powered by Jitsi · room {selected.jitsi_room?.slice(0, 12)}…
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ScheduleClimateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="manual"
        onCreated={(ev) => {
          setEvents((prev) => [ev, ...prev]);
          setSelected(ev);
          navigate(`/app/calendar/events/${ev.id}`);
        }}
      />

      {callSession ? (
        <JitsiMeetEmbed
          roomName={callSession.roomName}
          displayName={callSession.displayName}
          subject={callSession.subject}
          domain={callSession.domain}
          onClose={() => {
            setCallSession(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
};

export default ClimateCalendar;
