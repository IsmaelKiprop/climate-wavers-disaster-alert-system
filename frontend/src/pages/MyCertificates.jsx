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

const MyCertificates = () => {
  const [treeCerts, setTreeCerts] = useState([]);
  const [championCert, setChampionCert] = useState(null);
  const [selectedTree, setSelectedTree] = useState(null);
  const [showTree, setShowTree] = useState(false);
  const [showChampion, setShowChampion] = useState(false);
  const [downloaded, setDownloaded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const me = getUser();

  useEffect(() => {
    const load = async () => {
      if (!me?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [treeRes, champRes] = await Promise.allSettled([
          client.run(
            "get",
            `${endpoints.treeProjectDonations}?donor=${me.id}`,
            null,
            true
          ),
          client.run("get", endpoints.championsCertificate, {}, true),
        ]);

        if (treeRes.status === "fulfilled" && treeRes.value?.results) {
          setTreeCerts(
            treeRes.value.results.map((donation) => ({
              certificate_id: `CW${donation.payment_reference}${donation.id}`,
              tree_type: donation.project_name || "Tree Planting",
              co2_absorption: donation.co2_absorption_per_tree || 0,
              location: `${donation.project_city || "Unknown"}, ${
                donation.project_country || "Unknown"
              }`,
              planting_date: new Date(donation.created_at).toLocaleDateString(),
              user_name:
                `${donation.donor_first_name || ""} ${donation.donor_last_name || ""}`.trim() ||
                donation.donor_username ||
                "Anonymous",
              trees_planted: donation.trees_purchased || 0,
              amount: donation.amount || 0,
              is_downloaded: donation.is_downloaded || false,
              kind: "tree",
            }))
          );
        } else {
          setTreeCerts([]);
        }

        if (champRes.status === "fulfilled" && champRes.value?.certificate) {
          setChampionCert(champRes.value.certificate);
        } else {
          setChampionCert(null);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load certificates");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [me]);

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
      <div className="min-h-[60vh] flex items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading certificates…</p>
      </div>
    );
  }

  if (!me?.id) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background px-4">
        <p className="text-sm text-muted">Sign in to view your certificates.</p>
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
                  {certificate.location}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <IoTime size={14} />
                  {certificate.planting_date}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <IoLeaf size={14} />
                  {certificate.trees_planted} tree
                  {certificate.trees_planted === 1 ? "" : "s"} planted
                </p>
                <div className="mt-auto pt-3">
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
