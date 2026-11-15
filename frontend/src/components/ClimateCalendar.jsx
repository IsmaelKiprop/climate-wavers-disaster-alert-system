import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  IoAdd,
  IoCalendarOutline,
  IoCallOutline,
  IoChevronBack,
  IoChevronForward,
  IoCreateOutline,
  IoEarthOutline,
  IoLeafOutline,
  IoRadioButtonOn,
  IoWarningOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { unwrapList } from "../utils/apiData";
import { getUser } from "../utils/factory";
import JitsiMeetEmbed from "./JitsiMeetEmbed";
import ScheduleClimateEventModal from "./ScheduleClimateEventModal";
import { env } from "../config/env";

const TYPE_LABEL = {
  disaster_briefing: "Disaster briefing",
  planting_day: "Planting day",
  huddle: "Climate huddle",
  observance: "Official day",
  international: "International day",
  government: "Government day",
  regional: "Regional day",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function formatTime(iso, timezone) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function EventTypeIcon({ type }) {
  if (type === "disaster_briefing") return <IoWarningOutline className="text-amber-600" />;
  if (type === "planting_day") return <IoLeafOutline className="text-primary" />;
  if (type === "observance" || type === "international" || type === "government" || type === "regional") {
    return <IoEarthOutline className="text-emerald-700" />;
  }
  return <IoCallOutline className="text-primary" />;
}

function eventDotClass(type, isLive) {
  if (isLive) return "bg-red-500";
  if (type === "disaster_briefing") return "bg-amber-500";
  if (type === "planting_day") return "bg-primary";
  if (type === "observance" || type === "international" || type === "government" || type === "regional") {
    return "bg-emerald-700";
  }
  return "bg-sky-500";
}

function normalizeObservance(row) {
  if (!row) return null;
  const occurs = row.occurs_on || (row.starts_at || "").slice(0, 10);
  return {
    ...row,
    id: row.id != null ? `obs-${row.slug || row.id}-${occurs}` : `obs-${occurs}`,
    is_observance: true,
    event_type: "observance",
    category: row.category,
    status: "scheduled",
    can_join: false,
    allow_tree_gifts: true,
  };
}

const ClimateCalendar = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const autoJoin =
    searchParams.get("join") === "1" ||
    Boolean(eventId && window.location.pathname.endsWith("/join"));

  const [events, setEvents] = useState([]);
  const [observances, setObservances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [scheduleDefaultStarts, setScheduleDefaultStarts] = useState(null);
  const [callSession, setCallSession] = useState(null);
  const [joining, setJoining] = useState(false);
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const me = getUser();

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

  const loadObservances = useCallback(async () => {
    const y = cursorMonth.getFullYear();
    try {
      const data = await client.run(
        "get",
        `${endpoints.calendarObservances}?year=${y}`,
        {},
        false
      );
      const list = (Array.isArray(data) ? data : unwrapList(data))
        .map(normalizeObservance)
        .filter(Boolean);
      setObservances(list);
    } catch {
      setObservances([]);
    }
  }, [cursorMonth]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadObservances();
  }, [loadObservances]);

  useEffect(() => {
    if (!eventId || !events.length) return;
    const found = events.find((e) => String(e.id) === String(eventId));
    if (found) {
      setSelected(found);
      const when = new Date(found.starts_at);
      if (!Number.isNaN(when.getTime())) {
        setSelectedDay(when);
        setCursorMonth(startOfMonth(when));
      }
    }
  }, [eventId, events]);

  const filtered = useMemo(() => {
    if (filter === "official") return [];
    if (filter === "all") return events;
    if (filter === "mine") {
      return events.filter((e) => e.my_role === "host" || e.my_rsvp === "yes");
    }
    return events.filter((e) => e.event_type === filter);
  }, [events, filter]);

  const visibleEvents = useMemo(
    () => filtered.filter((e) => e.status !== "cancelled"),
    [filtered]
  );

  const visibleObservances = useMemo(() => {
    if (filter === "mine") return [];
    if (filter === "official" || filter === "all") return observances;
    return [];
  }, [observances, filter]);

  const eventsByDayKey = useMemo(() => {
    const map = new Map();
    const push = (item) => {
      const d = new Date(item.starts_at || item.occurs_on);
      if (Number.isNaN(d.getTime())) return;
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    for (const event of visibleEvents) push(event);
    for (const obs of visibleObservances) push(obs);
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aObs = a.is_observance ? 1 : 0;
        const bObs = b.is_observance ? 1 : 0;
        if (aObs !== bObs) return aObs - bObs;
        return (
          new Date(a.starts_at) - new Date(b.starts_at) ||
          String(a.id).localeCompare(String(b.id))
        );
      });
    }
    return map;
  }, [visibleEvents, visibleObservances]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursorMonth));
    const end = endOfWeek(endOfMonth(cursorMonth));
    return eachDayOfInterval({ start, end });
  }, [cursorMonth]);

  const dayEvents = useMemo(() => {
    const key = format(selectedDay, "yyyy-MM-dd");
    return eventsByDayKey.get(key) || [];
  }, [eventsByDayKey, selectedDay]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...visibleEvents]
      .sort((a, b) => {
        const liveBoost = (x) => (x.status === "live" ? -1 : 0);
        return (
          liveBoost(a) - liveBoost(b) ||
          new Date(a.starts_at) - new Date(b.starts_at) ||
          a.id - b.id
        );
      })
      .filter(
        (e) =>
          e.status === "live" ||
          new Date(e.starts_at).getTime() > now - 6 * 3600 * 1000
      );
  }, [visibleEvents]);

  const selectEvent = (event) => {
    setSelected(event);
    if (event?.is_observance) {
      navigate("/app/calendar", { replace: true });
      return;
    }
    navigate(`/app/calendar/events/${event.id}`, { replace: true });
  };

  const giftForEvent = (event) => {
    if (!event || event.is_observance) {
      navigate("/app/plant-tree");
      return;
    }
    const path =
      event.gift_path ||
      `/app/plant-tree?event=${event.id}${
        event.tree_project ? `&project=${event.tree_project}` : ""
      }${event.host ? `&for=${event.host}` : ""}`;
    navigate(path);
  };

  const openScheduleForDay = (day) => {
    const starts = new Date(day);
    starts.setHours(10, 0, 0, 0);
    setScheduleDefaultStarts(starts);
    setShowCreate(true);
  };

  const joinEvent = async (event) => {
    if (!event?.id || event.is_observance || joining) return;
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
        prev && prev.id === event.id
          ? { ...prev, status: data.status || prev.status }
          : prev
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
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
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
              Month view with Climate Wavers events plus synced international and
              government environment days. Gift trees for any day&apos;s activities
              — invited or not.
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
            onClick={() => {
              setScheduleDefaultStarts(null);
              setShowCreate(true);
            }}
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
            { key: "official", label: "Official days" },
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

        {/* Month calendar */}
        <section className="border border-border bg-surface overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCursorMonth((m) => subMonths(m, 1))}
                className="h-9 w-9 inline-flex items-center justify-center border border-border text-foreground hover:bg-[var(--cw-overlay-soft)]"
                aria-label="Previous month"
              >
                <IoChevronBack size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCursorMonth(startOfMonth(now));
                  setSelectedDay(now);
                }}
                className="h-9 px-3 text-xs font-medium border border-border text-foreground hover:bg-[var(--cw-overlay-soft)]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCursorMonth((m) => addMonths(m, 1))}
                className="h-9 w-9 inline-flex items-center justify-center border border-border text-foreground hover:bg-[var(--cw-overlay-soft)]"
                aria-label="Next month"
              >
                <IoChevronForward size={18} />
              </button>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground tabular-nums">
              {format(cursorMonth, "MMMM yyyy")}
            </h2>
            <div className="hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Briefing
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Planting
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Huddle
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Live
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" /> Official
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-background">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-[10px] sm:text-xs font-medium text-muted uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="p-8 grid grid-cols-7 gap-px bg-border">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[72px] bg-surface animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border">
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayList = eventsByDayKey.get(key) || [];
                const inMonth = isSameMonth(day, cursorMonth);
                const isDaySelected = isSameDay(day, selectedDay);
                const today = isToday(day);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    onDoubleClick={() => openScheduleForDay(day)}
                    className={`min-h-[72px] sm:min-h-[96px] p-1.5 sm:p-2 text-left transition-colors bg-surface ${
                      !inMonth ? "opacity-40" : ""
                    } ${
                      isDaySelected
                        ? "ring-2 ring-inset ring-primary bg-[var(--cw-overlay-soft)]"
                        : "hover:bg-[var(--cw-overlay-soft)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center text-xs font-medium tabular-nums ${
                          today
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {dayList.length > 0 ? (
                        <span className="text-[10px] text-muted tabular-nums">
                          {dayList.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-0.5 hidden sm:block">
                      {dayList.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className="truncate text-[10px] leading-tight px-1 py-0.5 border border-border bg-background text-foreground"
                          title={ev.title}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${eventDotClass(
                              ev.event_type,
                              ev.status === "live"
                            )}`}
                          />
                          {formatTime(ev.starts_at, ev.timezone)} {ev.title}
                        </div>
                      ))}
                      {dayList.length > 3 ? (
                        <p className="text-[10px] text-muted px-1">
                          +{dayList.length - 3} more
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-0.5 sm:hidden mt-1">
                      {dayList.slice(0, 4).map((ev) => (
                        <span
                          key={ev.id}
                          className={`h-1.5 w-1.5 rounded-full ${eventDotClass(
                            ev.event_type,
                            ev.status === "live"
                          )}`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-3 sm:px-4 py-2 border-t border-border text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
            <span>Double-click a day to schedule · click an event below for details</span>
            <button
              type="button"
              onClick={() => openScheduleForDay(selectedDay)}
              className="h-8 px-2.5 border border-border text-foreground inline-flex items-center gap-1 hover:bg-[var(--cw-overlay-soft)]"
            >
              <IoAdd size={14} />
              Schedule on {format(selectedDay, "MMM d")}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 lg:gap-5 lg:items-start">
          <section className="lg:col-span-3 border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {format(selectedDay, "EEEE, MMM d")}
              </h2>
              <span className="text-xs text-muted">
                {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
              </span>
            </div>
            {dayEvents.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-muted">No events on this day.</p>
                <button
                  type="button"
                  onClick={() => openScheduleForDay(selectedDay)}
                  className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 mx-auto"
                >
                  <IoAdd size={16} />
                  Schedule for this day
                </button>
                {upcoming.length > 0 ? (
                  <div className="pt-4 border-t border-border text-left">
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-2 px-1">
                      Upcoming
                    </p>
                    <ul className="divide-y divide-border">
                      {upcoming.slice(0, 4).map((event) => (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => {
                              const when = new Date(event.starts_at);
                              setSelectedDay(when);
                              setCursorMonth(startOfMonth(when));
                              selectEvent(event);
                            }}
                            className="w-full text-left px-1 py-2.5 hover:bg-[var(--cw-overlay-soft)]"
                          >
                            <p className="text-sm font-medium text-foreground truncate">
                              {event.title}
                            </p>
                            <p className="text-xs text-muted">
                              {formatWhen(event.starts_at, event.timezone)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {dayEvents.map((event) => {
                  const isSelected = selected?.id === event.id;
                  const isLive = event.status === "live";
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => selectEvent(event)}
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
                              {event.is_observance
                                ? TYPE_LABEL[event.category] || "Official day"
                                : TYPE_LABEL[event.event_type] || event.event_type}
                              {!event.is_observance
                                ? ` · ${formatTime(event.starts_at, event.timezone)}`
                                : event.authority
                                  ? ` · ${event.authority}`
                                  : ""}
                            </p>
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
                <IoCalendarOutline className="text-muted" size={28} />
                <p className="text-sm text-muted max-w-[14rem]">
                  Select a day on the calendar, then an event to RSVP or join.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-[300px]">
                <div className="px-4 py-4 border-b border-border flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted">
                      {selected.is_observance
                        ? TYPE_LABEL[selected.category] || "Official day"
                        : TYPE_LABEL[selected.event_type]}
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
                    {selected.host_name
                      ? ` · ${selected.is_observance ? selected.host_name : `Host ${selected.host_name}`}`
                      : ""}
                  </p>
                  {selected.description ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selected.description}
                    </p>
                  ) : null}
                  {selected.is_observance ? (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="border border-border px-2.5 py-1 text-muted capitalize">
                        {selected.category || "official"}
                      </span>
                      {selected.authority ? (
                        <span className="border border-border px-2.5 py-1 text-muted">
                          {selected.authority}
                        </span>
                      ) : null}
                      {selected.source_url ? (
                        <a
                          href={selected.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-border px-2.5 py-1 text-muted hover:text-foreground"
                        >
                          Source
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <>
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
                        {selected.allow_tree_gifts !== false ? (
                          <span className="border border-border px-2.5 py-1 text-muted">
                            {selected.trees_gifted || 0} trees gifted
                          </span>
                        ) : null}
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
                    </>
                  )}
                </div>
                <div className="p-4 border-t border-border space-y-2">
                  {!selected.is_observance &&
                  me?.id &&
                  (String(selected.host) === String(me.id) ||
                    selected.my_role === "host") ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const fresh = await client.run(
                            "get",
                            `${endpoints.climateEvents}${selected.id}/`,
                            {},
                            true
                          );
                          setEditingEvent(fresh || selected);
                        } catch {
                          setEditingEvent(selected);
                        }
                      }}
                      className="w-full h-10 border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
                    >
                      <IoCreateOutline size={16} />
                      Edit & invite
                    </button>
                  ) : null}
                  {selected.allow_tree_gifts !== false ? (
                    <button
                      type="button"
                      onClick={() => giftForEvent(selected)}
                      className="w-full h-11 border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
                    >
                      <IoLeafOutline size={16} />
                      {selected.is_observance
                        ? "Plant trees for this day"
                        : "Gift trees for this day"}
                    </button>
                  ) : null}
                  {!selected.is_observance ? (
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
                  ) : null}
                  {!selected.is_observance &&
                  (selected.invite_count > 0 || selected.invites?.length > 0) ? (
                    <p className="text-[11px] text-muted text-center">
                      {selected.invite_count || selected.invites?.length || 0} invitee
                      {(selected.invite_count || selected.invites?.length || 0) === 1
                        ? ""
                        : "s"}
                    </p>
                  ) : selected.is_observance ? (
                    <p className="text-[11px] text-muted text-center">
                      Synced official environment day — contribute trees anytime
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted text-center">
                      Full-screen Climate Wavers conference
                    </p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ScheduleClimateEventModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setScheduleDefaultStarts(null);
        }}
        mode="manual"
        defaultStartsAt={scheduleDefaultStarts}
        onCreated={(ev) => {
          setEvents((prev) => [ev, ...prev]);
          setSelected(ev);
          const when = new Date(ev.starts_at);
          if (!Number.isNaN(when.getTime())) {
            setSelectedDay(when);
            setCursorMonth(startOfMonth(when));
          }
          navigate(`/app/calendar/events/${ev.id}`);
        }}
      />

      <ScheduleClimateEventModal
        open={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        mode="edit"
        event={editingEvent}
        onUpdated={(ev) => {
          setEvents((prev) =>
            prev.map((e) => (String(e.id) === String(ev.id) ? { ...e, ...ev } : e))
          );
          setSelected((prev) =>
            prev && String(prev.id) === String(ev.id) ? { ...prev, ...ev } : prev
          );
          setEditingEvent(null);
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
