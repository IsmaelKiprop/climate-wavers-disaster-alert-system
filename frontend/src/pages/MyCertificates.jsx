import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IoLeaf,
  IoRibbonOutline,
  IoCheckmarkCircle,
  IoTime,
  IoLocation,
} from "react-icons/io5";
import { toast } from "react-toastify";
import TreeCertificate from "../components/TreeCertificate";
import ChampionCertificate from "../components/ChampionCertificate";
import { getUser } from "../utils/factory";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const mapDonationToCert = (donation) => {
  const species =
    donation.selected_species && typeof donation.selected_species === "object"
      ? Object.entries(donation.selected_species)
          .filter(([, qty]) => Number(qty) > 0)
          .map(([name, qty]) => `${name} x ${qty}`)
          .join(", ")
      : "";
  const proof = donation.planting_proof || null;
  const planted = (donation.planting_status || "") === "planted";
  const proofPlace =
    proof?.location_label ||
    (proof?.latitude != null && proof?.longitude != null
      ? `${proof.latitude}, ${proof.longitude}`
      : "");
  return {
    id: donation.id,
    certificate_id:
      donation.certificate_id ||
      `CW-${donation.payment_reference}-${donation.id}`,
    tree_type: species || donation.project_name || "Tree Planting",
    project_name: donation.project_name || "",
    species,
    co2_absorption: Number(donation.co2_absorption_per_tree || 0),
    location: `${donation.project_city || "Unknown"}, ${
      donation.project_country || "Unknown"
    }`,
    planting_date: donation.created_at
      ? new Date(donation.created_at).toLocaleDateString()
      : "",
    planted_at: donation.planted_at
      ? new Date(donation.planted_at).toLocaleDateString()
      : "",
    planting_status: donation.planting_status || "funded",
    planting_proof: proof,
    proof_place: proofPlace,
    user_name:
      donation.donor_display_name || donation.donor_name || "Anonymous",
    gifted_to: donation.gifted_to_name || "",
    trees_planted: donation.trees_purchased || 0,
    amount: donation.amount || 0,
    payment_reference: donation.payment_reference || "",
    is_downloaded: donation.is_downloaded || false,
    certificate_emailed_at: donation.certificate_emailed_at || null,
    kind: "tree",
    is_planted: planted,
  };
};

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const MyCertificates = () => {
  const [treeCerts, setTreeCerts] = useState([]);
  const [championCert, setChampionCert] = useState(null);
  const [selectedTree, setSelectedTree] = useState(null);
  const [showTree, setShowTree] = useState(false);
  const [proofTree, setProofTree] = useState(null);
  const [showChampion, setShowChampion] = useState(false);
  const [downloaded, setDownloaded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const me = getUser();
  const userId = me?.id || null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setLoading(false);
        setLoadError("");
        return;
      }
      setLoading(true);
      setLoadError("");
      try {
        const timed = (promise, ms = 20000) =>
          Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Request timed out")), ms)
            ),
          ]);

        const [treeRes, giftedRes, champRes] = await Promise.allSettled([
          timed(
            client.run(
              "get",
              `${endpoints.treeProjectDonations}?donor=${userId}`,
              null,
              true
            )
          ),
          timed(
            client.run(
              "get",
              `${endpoints.treeProjectDonations}?gifted_to=${userId}`,
              null,
              true
            )
          ),
          timed(client.run("get", endpoints.championsCertificate, {}, true)),
        ]);

        if (cancelled) return;

        const byId = new Map();
        const ingest = (payload) => {
          unwrapList(payload)
            .filter((d) => (d.payment_status || "completed") === "completed")
            .forEach((d) => {
              if (d?.id != null) byId.set(d.id, mapDonationToCert(d));
            });
        };
        if (treeRes.status === "fulfilled") ingest(treeRes.value);
        else console.error("Tree certificates load failed:", treeRes.reason);
        if (giftedRes.status === "fulfilled") ingest(giftedRes.value);
        else console.error("Gifted certificates load failed:", giftedRes.reason);

        setTreeCerts([...byId.values()]);

        if (champRes.status === "fulfilled" && champRes.value?.certificate) {
          setChampionCert(champRes.value.certificate);
        } else {
          setChampionCert(null);
          if (champRes.status === "rejected") {
            console.error("Champion certificate load failed:", champRes.reason);
          }
        }

        if (
          treeRes.status === "rejected" &&
          giftedRes.status === "rejected" &&
          champRes.status === "rejected"
        ) {
          setLoadError(
            "Could not load certificates. The server may be waking up — try again."
          );
          toast.error("Failed to load certificates");
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setTreeCerts([]);
        setChampionCert(null);
        setLoadError(err?.message || "Failed to load certificates");
        toast.error("Failed to load certificates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const markTreeDownloaded = async (certificateId) => {
    try {
      setDownloaded((prev) => new Set([...prev, certificateId]));
      await client.run(
        "post",
        endpoints.markCertificateDownloaded,
        { certificate_id: certificateId, user_id: me.id },
        true
      );
      setTreeCerts((prev) =>
        prev.map((c) =>
          c.certificate_id === certificateId ? { ...c, is_downloaded: true } : c
        )
      );
      toast.success("Certificate marked as downloaded");
    } catch {
      toast.error("Failed to mark certificate as downloaded");
    }
  };

  const totalCount = treeCerts.length + (championCert ? 1 : 0);
  const treesPlanted = treeCerts.reduce(
    (sum, c) => sum + (c.trees_planted || 1),
    0
  );
  const co2 = treeCerts.reduce((sum, c) => sum + (c.co2_absorption || 15), 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-background px-4">
        <p className="text-sm text-muted">Loading certificates…</p>
        <p className="text-xs text-muted">This can take a moment if the API is waking up.</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background px-4">
        <p className="text-sm text-muted">Sign in to view your certificates.</p>
      </div>
    );
  }

  if (loadError && totalCount === 0) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Certificates unavailable
          </h1>
          <p className="text-sm text-muted">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="h-11 px-4 inline-flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">
            No certificates yet
          </h1>
          <p className="text-sm text-muted mt-2">
            Complete Community Champion training or plant a tree to earn one.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              to="/app/champions"
              className="h-11 px-4 inline-flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold"
            >
              Champion training
            </Link>
            <Link
              to="/app/plant-tree"
              className="h-11 px-4 inline-flex items-center justify-center border border-border text-sm font-medium"
            >
              Plant a tree
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            My certificates
          </h1>
          <p className="text-sm text-muted mt-1">
            Community Champion training and tree planting credentials
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {championCert ? (
            <article className="border border-primary bg-surface overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center border-[3px] border-primary text-primary rounded-full shrink-0">
                    <IoRibbonOutline size={22} />
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
                      Training
                    </p>
                    <h2 className="text-lg font-semibold mt-0.5">
                      Community Champion
                    </h2>
                    <p className="text-xs text-muted mt-1 font-mono break-all">
                      {championCert.certificate_code}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-3">
                <p className="text-sm text-muted">
                  {championCert.modules_completed}/{championCert.modules_total}{" "}
                  modules · quiz ≥ 70%
                </p>
                {championCert.issued_at ? (
                  <p className="text-sm text-muted inline-flex items-center gap-1.5">
                    <IoTime size={14} />
                    Issued{" "}
                    {new Date(championCert.issued_at).toLocaleDateString()}
                  </p>
                ) : null}
                <div className="mt-auto space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChampion(true)}
                    className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <IoCheckmarkCircle size={16} />
                    View certificate
                  </button>
                  {championCert.verify_path ? (
                    <Link
                      to={championCert.verify_path}
                      className="w-full h-10 border border-border text-sm font-medium inline-flex items-center justify-center"
                    >
                      Public verify page
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ) : null}

          {treeCerts.map((certificate) => (
            <article
              key={certificate.certificate_id}
              className="border border-border bg-surface overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-border">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center border border-border text-primary shrink-0">
                    <IoLeaf size={22} />
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted font-semibold">
                      Restore
                    </p>
                    <h2 className="text-lg font-semibold mt-0.5">
                      Tree planting
                    </h2>
                    <p className="text-xs text-muted mt-1 break-all">
                      #{certificate.certificate_id}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-2 text-sm text-muted">
                <p className="inline-flex items-center gap-1.5">
                  <IoLocation size={14} />
                  {certificate.proof_place || certificate.location}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <IoTime size={14} />
                  {certificate.is_planted
                    ? `Planted ${certificate.planted_at || certificate.planting_date}`
                    : `Funded ${certificate.planting_date}`}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <IoLeaf size={14} />
                  {certificate.trees_planted} tree
                  {certificate.trees_planted === 1 ? "" : "s"}
                  {certificate.is_planted ? " · proof shared" : " · awaiting planting"}
                </p>
                {certificate.is_planted ? (
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Verified planting
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    OKOA / host will share photo, video and location after planting.
                  </p>
                )}
                <div className="mt-auto pt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTree(certificate);
                      setShowTree(true);
                    }}
                    className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <IoCheckmarkCircle size={16} />
                    View certificate
                  </button>
                  {certificate.is_planted && certificate.planting_proof ? (
                    <button
                      type="button"
                      onClick={() => setProofTree(certificate)}
                      className="w-full h-10 border border-border text-sm font-medium"
                    >
                      View planting proof
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Your impact snapshot</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
            <div>
              <p className="text-2xl font-semibold text-primary">{totalCount}</p>
              <p className="text-sm text-muted">Certificates</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-primary">{treesPlanted}</p>
              <p className="text-sm text-muted">Trees planted</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-primary">{co2}kg</p>
              <p className="text-sm text-muted">CO₂ absorption (est.)</p>
            </div>
          </div>
        </div>
      </div>

      <TreeCertificate
        isOpen={showTree}
        onClose={() => setShowTree(false)}
        certificateData={selectedTree}
        onDownload={markTreeDownloaded}
        onShare={() => toast.success("Certificate shared")}
        isDownloaded={
          selectedTree
            ? downloaded.has(selectedTree.certificate_id) ||
              selectedTree.is_downloaded
            : false
        }
      />

      {proofTree?.planting_proof ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60">
          <div className="bg-surface border border-border w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border sticky top-0 bg-surface">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold">
                  Planting proof
                </p>
                <h2 className="text-lg font-semibold text-foreground mt-0.5">
                  {proofTree.project_name || "Your tree"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProofTree(null)}
                className="text-muted hover:text-foreground text-sm"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {proofTree.planting_proof.content ? (
                <p className="text-foreground leading-relaxed">
                  {proofTree.planting_proof.content}
                </p>
              ) : null}
              {(proofTree.proof_place || proofTree.planting_proof.latitude != null) && (
                <p className="inline-flex items-start gap-1.5 text-muted">
                  <IoLocation size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {proofTree.proof_place ||
                      `${proofTree.planting_proof.latitude}, ${proofTree.planting_proof.longitude}`}
                    {proofTree.planting_proof.latitude != null &&
                    proofTree.planting_proof.longitude != null ? (
                      <>
                        {" · "}
                        <a
                          className="text-primary hover:underline"
                          href={`https://www.google.com/maps?q=${proofTree.planting_proof.latitude},${proofTree.planting_proof.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open map
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              )}
              {Array.isArray(proofTree.planting_proof.images) &&
              proofTree.planting_proof.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {proofTree.planting_proof.images.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="Planting"
                      className="w-full aspect-square object-cover border border-border"
                    />
                  ))}
                </div>
              ) : null}
              {Array.isArray(proofTree.planting_proof.videos) &&
              proofTree.planting_proof.videos.length > 0 ? (
                <div className="space-y-2">
                  {proofTree.planting_proof.videos.map((url) => (
                    <video
                      key={url}
                      src={url}
                      controls
                      className="w-full border border-border bg-black"
                    />
                  ))}
                </div>
              ) : null}
              {proofTree.planted_at ? (
                <p className="text-xs text-muted">
                  Shared {proofTree.planted_at}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ChampionCertificate
        isOpen={showChampion}
        onClose={() => setShowChampion(false)}
        certificate={championCert}
        onSaveDetails={async (fields) => {
          const data = await client.run("patch", endpoints.championsMe, fields, true);
          const cert =
            data?.certificate ||
            (await client.run("get", endpoints.championsCertificate, {}, true))
              ?.certificate;
          if (cert) setChampionCert(cert);
          return cert;
        }}
      />
    </div>
  );
};

export default MyCertificates;
