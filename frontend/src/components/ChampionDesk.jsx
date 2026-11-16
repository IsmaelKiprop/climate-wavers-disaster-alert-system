import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import ChampionCertificate from "./ChampionCertificate";

const TABS = ["Verify", "Warn", "Network", "Training", "Cameras", "Impact"];

const ChampionDesk = () => {
  const [tab, setTab] = useState("Training");
  const [me, setMe] = useState(null);
  const [impact, setImpact] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [training, setTraining] = useState([]);
  const [trainingMeta, setTrainingMeta] = useState({
    completed_count: 0,
    total: 7,
    certificate: null,
    path_complete: false,
  });
  const [activeModule, setActiveModule] = useState(null);
  const [moduleDetail, setModuleDetail] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [showCert, setShowCert] = useState(false);
  const [certData, setCertData] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraMeta, setCameraMeta] = useState({ partner_count: 0, public_count: 0, public_fallback: false });
  const [templates, setTemplates] = useState([]);
  const [warnRadius, setWarnRadius] = useState(1000);
  const [warnPreview, setWarnPreview] = useState(null);
  const [warnTemplate, setWarnTemplate] = useState("");
  const [warnNote, setWarnNote] = useState("");
  const [enrollForm, setEnrollForm] = useState({
    name: "",
    email: "",
    phone: "",
    sms_opt_in: false,
  });
  const [camForm, setCamForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    stream_url: "",
    consent_note: "",
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [feedComparison, setFeedComparison] = useState("matches");

  const loadMe = useCallback(async () => {
    try {
      const data = await client.run("get", endpoints.championsMe, {}, true);
      setMe(data?.champion || null);
      setImpact(data?.impact || null);
      setTemplates(data?.warn_templates || []);
      if (data?.warn_templates?.[0]) setWarnTemplate(data.warn_templates[0]);
    } catch {
      setMe(null);
      setImpact(null);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const data = await client.run("get", endpoints.championsVerifyQueue, {}, true);
      setQueue(data?.results || []);
    } catch (err) {
      setQueue([]);
      if (err?.response?.data?.detail) {
        /* pending champions see empty */
      }
    }
  }, []);

  const loadEnrollments = useCallback(async () => {
    try {
      const data = await client.run("get", endpoints.championsEnrollments, {}, true);
      setEnrollments(data?.results || []);
    } catch {
      setEnrollments([]);
    }
  }, []);

  const loadTraining = useCallback(async () => {
    try {
      const data = await client.run("get", endpoints.championsTraining, {}, true);
      setTraining(data?.modules || []);
      setTrainingMeta({
        completed_count: data?.completed_count || 0,
        total: data?.total || 7,
        certificate: data?.certificate || null,
        path_complete: Boolean(data?.path_complete),
      });
      if (data?.certificate) setCertData(data.certificate);
    } catch {
      setTraining([]);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!me) return;
    // Pending applicants can train; Verify / Network need active status
    if (me.status !== "active") {
      if (tab !== "Training" && tab !== "Impact") {
        setTab("Training");
        return;
      }
      if (tab === "Training") loadTraining();
      return;
    }
    if (tab === "Verify") loadQueue();
    if (tab === "Network") loadEnrollments();
    if (tab === "Training") loadTraining();
  }, [tab, me, loadQueue, loadEnrollments, loadTraining]);

  const checkIn = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation unavailable");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await client.run(
            "post",
            endpoints.championsCheckIn,
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy_m: pos.coords.accuracy,
            },
            true
          );
          toast.success("Checked in");
          await loadMe();
          await loadQueue();
        } catch (err) {
          toast.error(err?.response?.data?.detail || "Check-in failed");
        } finally {
          setBusy(false);
        }
      },
      () => {
        toast.error("Could not get GPS");
        setBusy(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const getGps = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("no geo"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        reject,
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });

  const submitDecision = async (decision) => {
    if (!selected) return;
    setBusy(true);
    try {
      let coords = {};
      try {
        const c = await getGps();
        coords = {
          latitude: c.latitude,
          longitude: c.longitude,
          accuracy_m: c.accuracy,
        };
      } catch {
        if (decision !== "escalate") {
          toast.error("GPS required to confirm or deny");
          setBusy(false);
          return;
        }
      }
      const data = await client.run(
        "post",
        endpoints.championsVerifications,
        {
          disaster_id: selected.id,
          decision,
          note,
          feed_comparison: feedComparison,
          field_signals: {
            still_active: true,
          },
          evidence: [],
          ...coords,
        },
        true
      );
      toast.success(`Recorded ${decision} (score ${data?.verification?.evidence_score ?? "—"})`);
      setSelected(null);
      setNote("");
      loadQueue();
      loadMe();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const startLiveCam = async () => {
    setBusy(true);
    try {
      const data = await client.run("post", endpoints.championsLiveCam, {}, true);
      toast.success(`Ground-truth room: ${data?.roomName || data?.jitsi_room}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not start live cam");
    } finally {
      setBusy(false);
    }
  };

  const loadCameras = async () => {
    if (!selected?.id && !me) return;
    try {
      const q = selected?.id
        ? `?disaster_id=${selected.id}&include_public=1`
        : "?include_public=1";
      const data = await client.run(
        "get",
        `${endpoints.championsCamerasNearby}${q}`,
        {},
        true
      );
      setCameras(data?.results || []);
      setCameraMeta({
        partner_count: data?.partner_count || 0,
        public_count: data?.public_count || 0,
        public_fallback: Boolean(data?.public_fallback),
      });
      if ((data?.partner_count || 0) === 0 && (data?.public_count || 0) > 0) {
        toast.info("No partner CCTV — showing public nearby webcams");
      }
    } catch {
      setCameras([]);
      setCameraMeta({ partner_count: 0, public_count: 0, public_fallback: false });
    }
  };

  const openPlayback = async (cam) => {
    setBusy(true);
    try {
      const data = await client.run(
        "post",
        endpoints.championsCameraPlayback(cam.id),
        {
          latitude: selected?.latitude,
          longitude: selected?.longitude,
        },
        true
      );
      const url = data?.playback_url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        toast.success(cam.public ? "Opened public feed" : "Opened partner stream");
      } else {
        toast.error("No playable URL for this camera");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Playback failed");
    } finally {
      setBusy(false);
    }
  };

  const recordCam = async (cameraId, isPublic = false) => {
    setBusy(true);
    try {
      await client.run(
        "post",
        endpoints.championsCameraRecord(cameraId),
        {
          disaster_id: selected?.id,
          duration_s: 30,
          snapshot: true,
          latitude: selected?.latitude,
          longitude: selected?.longitude,
        },
        true
      );
      toast.success(
        isPublic
          ? "Public webcam snapshot captured for evidence"
          : "Moment recorded — syncing"
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Record failed");
    } finally {
      setBusy(false);
    }
  };

  const previewWarn = async () => {
    if (!selected) {
      toast.error("Select a hazard first");
      return;
    }
    try {
      const data = await client.run(
        "get",
        `${endpoints.championsWarnPreview}?disaster_id=${selected.id}&radius_m=${warnRadius}`,
        {},
        true
      );
      setWarnPreview(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Preview failed");
    }
  };

  const sendWarn = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      // Share our location ping so we participate in network
      try {
        const c = await getGps();
        await client.run(
          "post",
          endpoints.championsLocationPing,
          {
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy_m: c.accuracy,
            proximity_alerts_opt_in: true,
          },
          true
        );
      } catch {
        /* optional */
      }
      const data = await client.run(
        "post",
        endpoints.championsWarn,
        {
          disaster_id: selected.id,
          radius_m: warnRadius,
          message_template: warnTemplate,
          note: warnNote,
          latitude: selected.latitude,
          longitude: selected.longitude,
        },
        true
      );
      toast.success(
        `Warned nearby — ${data?.delivered_count ?? 0} phones (of ${data?.targeted_count ?? 0})`
      );
      loadMe();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Warn failed");
    } finally {
      setBusy(false);
    }
  };

  const addEnrollment = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.run("post", endpoints.championsEnrollments, enrollForm, true);
      toast.success("Household enrolled");
      setEnrollForm({ name: "", email: "", phone: "", sms_opt_in: false });
      loadEnrollments();
      loadMe();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not enroll");
    } finally {
      setBusy(false);
    }
  };

  const openModule = async (moduleId, locked) => {
    if (locked) {
      toast.error("Pass the previous module quiz first");
      return;
    }
    setBusy(true);
    setQuizResult(null);
    setQuizAnswers({});
    try {
      const data = await client.run(
        "get",
        endpoints.championsTrainingModule(moduleId),
        {},
        true
      );
      setActiveModule(moduleId);
      setModuleDetail(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not open module");
    } finally {
      setBusy(false);
    }
  };

  const submitQuiz = async () => {
    if (!activeModule || !moduleDetail?.quiz?.length) return;
    const missing = moduleDetail.quiz.some(
      (q) => quizAnswers[q.id] === undefined || quizAnswers[q.id] === ""
    );
    if (missing) {
      toast.error("Answer every question");
      return;
    }
    setBusy(true);
    try {
      const data = await client.run(
        "post",
        endpoints.championsTrainingQuiz(activeModule),
        { answers: quizAnswers },
        true
      );
      setQuizResult(data?.result || null);
      if (data?.result?.passed) {
        toast.success(`Passed with ${data.result.score}%`);
        setModuleDetail((d) => (d ? { ...d, completed: true, best_score: data.result.score } : d));
        if (data.certificate_issued && data.certificate) {
          setCertData(data.certificate);
          setShowCert(true);
          toast.success("Branded certificate unlocked");
        }
        await loadTraining();
        await loadMe();
      } else {
        toast.error(
          `Score ${data?.result?.score ?? 0}% — need ${data?.result?.pass_score ?? 70}% to pass. Retry.`
        );
        await loadTraining();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Quiz submit failed");
    } finally {
      setBusy(false);
    }
  };

  const openCertificate = async () => {
    try {
      const data = await client.run("get", endpoints.championsCertificate, {}, true);
      setCertData(data?.certificate || trainingMeta.certificate);
      setShowCert(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Certificate not ready yet");
    }
  };

  const saveCertificateDetails = async (fields) => {
    const data = await client.run("patch", endpoints.championsMe, fields, true);
    if (data?.champion) setMe(data.champion);
    const cert =
      data?.certificate ||
      (await client.run("get", endpoints.championsCertificate, {}, true))?.certificate;
    if (cert) {
      setCertData(cert);
      setTrainingMeta((m) => ({ ...m, certificate: cert }));
    }
    return cert;
  };

  const nextTrainingModule = (() => {
    if (!activeModule || !training.length) return null;
    const idx = training.findIndex((m) => m.id === activeModule);
    if (idx < 0) return null;
    return (
      training.slice(idx + 1).find((m) => !m.locked && !m.completed) ||
      training.slice(idx + 1).find((m) => !m.locked) ||
      null
    );
  })();

  const goToNextModule = async () => {
    if (!nextTrainingModule) {
      setActiveModule(null);
      setModuleDetail(null);
      setQuizResult(null);
      return;
    }
    await openModule(nextTrainingModule.id, nextTrainingModule.locked);
  };

  const backToPath = () => {
    setActiveModule(null);
    setModuleDetail(null);
    setQuizResult(null);
  };

  const registerCamera = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.run(
        "post",
        endpoints.championsCameras,
        {
          ...camForm,
          latitude: Number(camForm.latitude),
          longitude: Number(camForm.longitude),
          stream_type: "hls",
        },
        true
      );
      toast.success("Camera submitted for approval");
      setCamForm({
        name: "",
        latitude: "",
        longitude: "",
        stream_url: "",
        consent_note: "",
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Camera register failed");
    } finally {
      setBusy(false);
    }
  };

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Champion Desk</h1>
        <p className="text-sm text-muted">
          You are not a Community Champion yet. Apply to verify hazards on the ground.
        </p>
        <Link
          to="/champions/apply"
          className="inline-flex h-11 px-4 items-center bg-primary text-primary-foreground text-sm font-semibold"
        >
          Apply as Community Champion
        </Link>
        <Link to="/champions" className="block text-sm text-primary">
          Browse champion directory
        </Link>
      </div>
    );
  }

  const pending = me.status === "pending";
  const active = me.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Community Champions</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-1">
              {me.display_name}
            </h1>
            <p className="text-sm text-muted mt-1">
              {me.status} · {me.tier} · {me.city || me.ward || me.country} · {me.radius_km} km
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkIn}
              disabled={busy || !active}
              className="h-10 px-3 border border-border text-sm disabled:opacity-50"
              title={!active ? "Available after approval" : undefined}
            >
              GPS check-in
            </button>
            <Link to="/champions" className="h-10 px-3 border border-border text-sm inline-flex items-center">
              Directory
            </Link>
          </div>
        </header>

        {pending ? (
          <div className="border border-primary p-4 text-sm space-y-1">
            <p className="font-semibold text-foreground">Application pending approval</p>
            <p className="text-muted">
              Climate Wavers staff will review your application. Finish Champion training
              now — Verify, Warn, and Network unlock after you are approved.
            </p>
          </div>
        ) : null}

        {!active && !pending ? (
          <div className="border border-border p-4 text-sm text-muted">
            Champion status: <span className="text-foreground font-medium">{me.status}</span>.
            Training remains available; field tools need an active profile.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1 border-b border-border pb-2">
          {TABS.map((t) => {
            const locked = !active && t !== "Training" && t !== "Impact";
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (locked) {
                    toast.info("Available after your application is approved");
                    return;
                  }
                  setTab(t);
                }}
                className={`h-9 px-3 text-sm ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : locked
                      ? "text-muted opacity-60"
                      : "text-foreground hover:bg-[var(--cw-overlay-soft)]"
                }`}
              >
                {t}
                {locked ? " · locked" : ""}
              </button>
            );
          })}
        </div>

        {tab === "Verify" && active ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted">Nearby hazards</p>
              {queue.length === 0 ? (
                <p className="text-sm text-muted">
                  No hazards in your radius. Check in with GPS or wait for Detect feeds.
                </p>
              ) : (
                queue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      setCameras([]);
                    }}
                    className={`w-full text-left border p-3 ${
                      selected?.id === item.id
                        ? "border-primary bg-[var(--cw-overlay-soft)]"
                        : "border-border"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {item.disaster_type} · {item.distance_km} km · {item.status}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="lg:col-span-3 border border-border p-4 space-y-4 min-h-[280px]">
              {!selected ? (
                <p className="text-sm text-muted">Select a hazard to verify.</p>
              ) : (
                <>
                  {selected.cover_image ? (
                    <img
                      src={selected.cover_image}
                      alt=""
                      className="w-full h-40 object-cover"
                    />
                  ) : null}
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selected.title}</h2>
                    <p className="text-sm text-muted mt-1">{selected.description}</p>
                  </div>
                  <label className="block text-xs text-muted">
                    Feed comparison
                    <select
                      className="mt-1 w-full h-10 border border-border bg-surface px-2 text-sm"
                      value={feedComparison}
                      onChange={(e) => setFeedComparison(e.target.value)}
                    >
                      <option value="matches">Matches feed</option>
                      <option value="worse">Worse than feed</option>
                      <option value="false_alarm">False alarm</option>
                      <option value="unclear">Unclear</option>
                    </select>
                  </label>
                  <label className="block text-xs text-muted">
                    Note
                    <textarea
                      className="mt-1 w-full border border-border bg-surface p-2 text-sm"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={() => submitDecision("confirm")}
                      className="h-10 px-3 bg-primary text-primary-foreground text-sm font-semibold"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={() => submitDecision("deny")}
                      className="h-10 px-3 border border-border text-sm"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={() => submitDecision("escalate")}
                      className="h-10 px-3 border border-border text-sm"
                    >
                      Escalate
                    </button>
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={startLiveCam}
                      className="h-10 px-3 border border-border text-sm"
                    >
                      Phone live cam
                    </button>
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={loadCameras}
                      className="h-10 px-3 border border-border text-sm"
                    >
                      Nearby CCTV
                    </button>
                  </div>
                  {cameras.length ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted">
                        Cameras
                        {cameraMeta.public_fallback
                          ? " · public nearby fallback"
                          : cameraMeta.public_count
                            ? ` · ${cameraMeta.partner_count} partner / ${cameraMeta.public_count} public`
                            : ""}
                      </p>
                      {cameras.map((cam) => (
                        <div
                          key={cam.id}
                          className="flex flex-wrap items-center justify-between gap-2 border border-border p-2 text-sm"
                        >
                          <span className="min-w-0">
                            {cam.name} · {cam.distance_km} km
                            {cam.public ? (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">
                                Public OSM
                              </span>
                            ) : (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                                Partner
                              </span>
                            )}
                            {!cam.has_stream ? (
                              <span className="ml-2 text-[10px] text-muted">no open URL</span>
                            ) : null}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={!cam.has_stream || busy}
                              onClick={() => openPlayback(cam)}
                              className="h-8 px-2 border border-border text-xs disabled:opacity-40"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              disabled={!cam.has_stream || busy}
                              onClick={() => recordCam(cam.id, Boolean(cam.public))}
                              className="h-8 px-2 border border-border text-xs disabled:opacity-40"
                            >
                              {cam.public ? "Capture" : "Record moment"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        {tab === "Warn" && active ? (
          <div className="max-w-xl space-y-4 border border-border p-4">
            <p className="text-sm text-muted">
              Geofenced phone siren for people who opted in and were recently near the hazard.
              Not SMS-first.
            </p>
            {!selected ? (
              <p className="text-sm text-foreground">
                Open Verify, select a hazard, then return here — or pick from the queue:
              </p>
            ) : (
              <p className="text-sm font-medium">{selected.title}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {queue.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="h-8 px-2 border border-border text-xs"
                >
                  {item.title.slice(0, 28)}
                </button>
              ))}
            </div>
            <label className="block text-xs text-muted">
              Radius (m)
              <input
                type="number"
                className="mt-1 w-full h-10 border border-border px-2"
                value={warnRadius}
                onChange={(e) => setWarnRadius(Number(e.target.value) || 1000)}
              />
            </label>
            <label className="block text-xs text-muted">
              Message
              <select
                className="mt-1 w-full h-10 border border-border px-2"
                value={warnTemplate}
                onChange={(e) => setWarnTemplate(e.target.value)}
              >
                {(templates.length ? templates : ["Hazard nearby — stay safe"]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Short note
              <input
                className="mt-1 w-full h-10 border border-border px-2"
                maxLength={120}
                value={warnNote}
                onChange={(e) => setWarnNote(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={previewWarn}
                className="h-10 px-3 border border-border text-sm"
              >
                Preview count
              </button>
              <button
                type="button"
                disabled={busy || pending || !selected}
                onClick={sendWarn}
                className="h-10 px-3 bg-primary text-primary-foreground text-sm font-semibold"
              >
                Warn nearby
              </button>
            </div>
            {warnPreview ? (
              <p className="text-sm text-muted">
                ~{warnPreview.count} phones in {warnPreview.radius_m} m
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "Network" && active ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={addEnrollment} className="border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Enroll household</p>
              <input
                className="w-full h-10 border border-border px-2 text-sm"
                placeholder="Name"
                value={enrollForm.name}
                onChange={(e) => setEnrollForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full h-10 border border-border px-2 text-sm"
                placeholder="Email"
                value={enrollForm.email}
                onChange={(e) => setEnrollForm((f) => ({ ...f, email: e.target.value }))}
              />
              <input
                className="w-full h-10 border border-border px-2 text-sm"
                placeholder="Phone"
                value={enrollForm.phone}
                onChange={(e) => setEnrollForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enrollForm.sms_opt_in}
                  onChange={(e) =>
                    setEnrollForm((f) => ({ ...f, sms_opt_in: e.target.checked }))
                  }
                />
                SMS fallback opt-in
              </label>
              <button
                type="submit"
                disabled={busy || pending}
                className="h-10 px-3 bg-primary text-primary-foreground text-sm"
              >
                Add
              </button>
            </form>
            <div className="space-y-2">
              {enrollments.map((row) => (
                <div key={row.id} className="border border-border p-3 text-sm">
                  <p className="font-medium">{row.name || row.email || row.phone}</p>
                  <p className="text-xs text-muted">
                    {row.email} {row.phone}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "Training" ? (
          <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-border p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  Champion learning path
                </p>
                <p className="text-sm font-medium mt-1">
                  {trainingMeta.completed_count}/{trainingMeta.total} modules passed
                  (quiz ≥ 70%)
                </p>
              </div>
              {trainingMeta.path_complete || trainingMeta.certificate ? (
                <button
                  type="button"
                  onClick={openCertificate}
                  className="h-10 px-3 bg-primary text-primary-foreground text-sm font-semibold"
                >
                  View certificate
                </button>
              ) : (
                <p className="text-xs text-muted">
                  Finish every module quiz to unlock your branded certificate.
                </p>
              )}
            </div>

            {!activeModule ? (
              <ol className="space-y-2">
                {training.map((m) => (
                  <li
                    key={m.id}
                    className={`border p-4 ${
                      m.locked
                        ? "border-border opacity-60"
                        : m.completed
                          ? "border-primary"
                          : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted">
                          Module {m.index}
                          {m.locked ? " · locked" : m.completed ? " · passed" : ""}
                        </p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {m.title || m.label}
                        </p>
                        <p className="text-xs text-muted mt-1">{m.summary}</p>
                        <p className="text-[11px] text-muted mt-2">
                          ~{m.duration_min || 8} min · {m.quiz_count || 3} quiz questions
                          {m.attempts ? ` · ${m.attempts} attempt(s)` : ""}
                          {m.quiz_score ? ` · best ${m.quiz_score}%` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={m.locked || busy}
                        onClick={() => openModule(m.id, m.locked)}
                        className="h-9 px-3 border border-border text-xs font-medium disabled:opacity-40"
                      >
                        {m.completed ? "Review" : m.locked ? "Locked" : "Start"}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="border border-border p-4 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {moduleDetail?.title}
                  </h2>
                  <button
                    type="button"
                    onClick={backToPath}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Back to path
                  </button>
                </div>
                {moduleDetail?.objectives?.length ? (
                  <ul className="text-sm text-muted list-disc pl-5 space-y-1">
                    {moduleDetail.objectives.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="space-y-4">
                  {(moduleDetail?.lesson || []).map((block) => (
                    <section key={block.heading}>
                      <h3 className="text-sm font-semibold text-foreground">
                        {block.heading}
                      </h3>
                      <p className="text-sm text-foreground-soft mt-1 leading-relaxed">
                        {block.body}
                      </p>
                    </section>
                  ))}
                </div>
                <div className="border-t border-border pt-4 space-y-4">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    End-of-module quiz · pass {moduleDetail?.pass_score || 70}%
                  </p>
                  {(moduleDetail?.quiz || []).map((q) => (
                    <fieldset key={q.id} className="space-y-2">
                      <legend className="text-sm font-medium text-foreground">
                        {q.prompt}
                      </legend>
                      <div className="space-y-1.5">
                        {(q.choices || []).map((choice, idx) => (
                          <label
                            key={`${q.id}-${idx}`}
                            className="flex items-start gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="mt-1"
                              checked={Number(quizAnswers[q.id]) === idx}
                              onChange={() =>
                                setQuizAnswers((a) => ({ ...a, [q.id]: idx }))
                              }
                            />
                            <span>{choice}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  {quizResult ? (
                    <p
                      className={`text-sm font-medium ${
                        quizResult.passed ? "text-primary" : "text-destructive"
                      }`}
                    >
                      Score {quizResult.score}% —{" "}
                      {quizResult.passed
                        ? nextTrainingModule
                          ? `Passed. Continue to “${nextTrainingModule.title || nextTrainingModule.label}”.`
                          : "Passed. Path progress updated."
                        : `Need ${quizResult.pass_score}%. Try again.`}
                    </p>
                  ) : null}
                  {moduleDetail?.completed || quizResult?.passed ? (
                    <div className="flex flex-wrap gap-2">
                      {nextTrainingModule ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={goToNextModule}
                          className="h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                        >
                          {busy ? "Opening…" : `Continue → ${nextTrainingModule.title || nextTrainingModule.label}`}
                        </button>
                      ) : trainingMeta.path_complete || trainingMeta.certificate ? (
                        <button
                          type="button"
                          onClick={openCertificate}
                          className="h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold"
                        >
                          View certificate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={backToPath}
                          className="h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold"
                        >
                          Back to learning path
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={backToPath}
                        className="h-11 px-4 border border-border text-sm"
                      >
                        All modules
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={submitQuiz}
                      className="h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                    >
                      {busy ? "Checking…" : "Submit quiz"}
                    </button>
                  )}
                </div>
              </div>
            )}
            <ChampionCertificate
              isOpen={showCert}
              onClose={() => setShowCert(false)}
              certificate={certData}
              onSaveDetails={saveCertificateDetails}
            />
          </div>
        ) : null}

        {tab === "Cameras" && active ? (
          <form onSubmit={registerCamera} className="max-w-xl border border-border p-4 space-y-3">
            <p className="text-sm text-muted">
              Register an opt-in partner camera (school/church/org). Staff must approve.
            </p>
            <input
              className="w-full h-10 border border-border px-2 text-sm"
              placeholder="Camera name"
              value={camForm.name}
              onChange={(e) => setCamForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 border border-border px-2 text-sm"
                placeholder="Latitude"
                value={camForm.latitude}
                onChange={(e) => setCamForm((f) => ({ ...f, latitude: e.target.value }))}
                required
              />
              <input
                className="h-10 border border-border px-2 text-sm"
                placeholder="Longitude"
                value={camForm.longitude}
                onChange={(e) => setCamForm((f) => ({ ...f, longitude: e.target.value }))}
                required
              />
            </div>
            <input
              className="w-full h-10 border border-border px-2 text-sm"
              placeholder="HLS stream URL (optional)"
              value={camForm.stream_url}
              onChange={(e) => setCamForm((f) => ({ ...f, stream_url: e.target.value }))}
            />
            <textarea
              className="w-full border border-border p-2 text-sm"
              rows={2}
              placeholder="Consent note"
              value={camForm.consent_note}
              onChange={(e) => setCamForm((f) => ({ ...f, consent_note: e.target.value }))}
            />
            <button
              type="submit"
              disabled={busy}
              className="h-10 px-3 bg-primary text-primary-foreground text-sm"
            >
              Register camera
            </button>
          </form>
        ) : null}

        {tab === "Impact" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Impact score", impact?.impact_score ?? me.impact_score ?? 0],
                [
                  "Community rating",
                  `${Number(impact?.rating_avg ?? me.rating_avg ?? 0).toFixed(1)} (${impact?.rating_count ?? me.rating_count ?? 0})`,
                ],
                ["Confirms", impact?.verifications?.confirms ?? "—"],
                ["People warned", impact?.alerts?.people_reached ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="border border-border p-4">
                  <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-semibold mt-1">{value ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Verifications", impact?.verifications?.total ?? me.verifications_count],
                ["Denies", impact?.verifications?.denies ?? 0],
                ["Escalates", impact?.verifications?.escalates ?? 0],
                ["Avg evidence", impact?.verifications?.avg_evidence_score ?? "—"],
                ["Households", impact?.enrollments ?? me.enrollments_count],
                ["Warn blasts", impact?.alerts?.blasts ?? me.proximity_blasts_count],
                ["Acks", impact?.alerts?.acked ?? 0],
                ["Need help", impact?.alerts?.need_help ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="border border-border p-3">
                  <p className="text-[11px] text-muted uppercase tracking-wide">{label}</p>
                  <p className="text-lg font-semibold mt-1">{value ?? 0}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              Impact score combines verifications, evidence quality, households enrolled,
              people reached by warn-nearby, training, and community ratings (0–100).
              Others rate you on the{" "}
              <Link to="/champions" className="text-primary">
                public directory
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ChampionDesk;
