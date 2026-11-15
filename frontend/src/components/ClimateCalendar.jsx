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

  const liveCount = upcoming.filter((e) => e.status === "live").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted inline-flex items-center gap-1.5">
              <IoCalendarOutline />
              Climate Action Calendar
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-1 tracking-tight">
              Briefings & planting days
            </h1>
            <p className="text-sm text-muted mt-1.5 max-w-lg">
              Plan disaster briefings, planting days, and huddles — then join the
              Climate Wavers room when it’s time.
            </p>
            {liveCount > 0 ? (
              <p className="mt-2 text-xs font-medium text-red-600 inline-flex items-center gap-1.5">
                <IoRadioButtonOn />
                {liveCount} live now
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0"
          >
            <IoAdd size={18} />
            Schedule event
          </button>
        </header>

        <div
          className="flex gap-1 overflow-x-auto border-b border-border pb-px"
          role="tablist"
          aria-label="Calendar filters"
        >
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
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`h-10 px-3 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                filter === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 lg:gap-5 lg:items-start">
          <section className="lg:col-span-3 border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Agenda</h2>
              <span className="text-xs text-muted">
                {loading ? "…" : `${upcoming.length} upcoming`}
              </span>
            </div>
            {loading ? (
              <div className="p-8 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 border border-border bg-background animate-pulse" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="mx-auto h-12 w-12 border border-border bg-background inline-flex items-center justify-center text-primary">
                  <IoCalendarOutline size={22} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No upcoming Climate events
                </p>
                <p className="text-xs text-muted max-w-xs mx-auto">
                  Schedule a planting day or disaster briefing to open a shared
                  Climate room.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 mx-auto"
                >
                  <IoAdd size={16} />
                  Schedule the first one
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((event) => {
                  const isSelected = selected?.id === event.id;
                  const isLive = event.status === "live";
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(event);
                          navigate(`/app/calendar/events/${event.id}`, { replace: true });
                        }}
                        className={`w-full text-left px-4 py-3.5 transition-colors ${
                          isSelected
                            ? "bg-[var(--cw-overlay-soft)] border-l-2 border-l-primary"
                            : "border-l-2 border-l-transparent hover:bg-[var(--cw-overlay-soft)]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 h-10 w-10 border bg-background inline-flex items-center justify-center shrink-0 ${
                              isLive ? "border-red-500/40" : "border-border"
                            }`}
                          >
                            <EventTypeIcon type={event.event_type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {event.title}
                              </p>
                              {isLive ? (
                                <span className="text-[10px] uppercase tracking-wide text-red-600 inline-flex items-center gap-1 font-medium">
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
                          {isLive ? (
                            <span className="shrink-0 text-[11px] font-medium text-primary self-center">
                              Join
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="lg:col-span-2 border border-t-0 lg:border-t border-border bg-surface min-h-[300px] lg:sticky lg:top-4">
            {!selected ? (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-2 min-h-[280px]">
                <IoCallOutline className="text-muted" size={28} />
                <p className="text-sm text-muted max-w-[14rem]">
                  Select an event to RSVP or open the Climate room.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-[300px]">
                <div className="px-4 py-4 border-b border-border flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted">
                      {TYPE_LABEL[selected.event_type]}
                      {selected.status === "live" ? " · Live" : ""}
                    </p>
                    <h3 className="text-lg font-semibold text-foreground leading-snug mt-0.5">
                      {selected.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="text-muted hover:text-foreground lg:hidden shrink-0"
                    onClick={() => setSelected(null)}
                    aria-label="Back"
                  >
                    <IoChevronBack size={20} />
                  </button>
                </div>
                <div className="p-4 space-y-4 flex-1">
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
                        className="border border-border px-2.5 py-1 text-muted hover:text-foreground"
                      >
                        Tree project
                      </Link>
                    ) : null}
                    {selected.disaster ? (
                      <Link
                        to={`/disasters/${selected.disaster}`}
                        className="border border-border px-2.5 py-1 text-muted hover:text-foreground"
                      >
                        Disaster
                      </Link>
                    ) : null}
                    <span className="border border-border px-2.5 py-1 text-muted capitalize">
                      {selected.visibility}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-2">
                      Your RSVP
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["yes", "maybe", "no"].map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => rsvp(choice)}
                          className={`h-9 px-3 text-xs font-medium border capitalize ${
                            selected.my_rsvp === choice
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-foreground hover:bg-[var(--cw-overlay-soft)]"
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-border space-y-2">
                  <button
                    type="button"
                    disabled={joining || selected.status === "cancelled"}
                    onClick={() => joinEvent(selected)}
                    className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <IoCallOutline size={18} />
                    {joining
                      ? "Opening room…"
                      : selected.status === "live"
                        ? "Join live room"
                        : "Enter Climate room"}
                  </button>
                  <p className="text-[11px] text-muted text-center">
                    Full-screen Climate Wavers conference
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
