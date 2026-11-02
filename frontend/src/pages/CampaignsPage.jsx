import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Campaign from "../components/Campaign";
import Topbar from "../components/Topbar";
import Pagination from "../components/Pagination";
import Payment from "../components/Payment";
import Modal from "../components/Modal";
import Footer from "../components/FooterBar";
import { CampaignsPageSEO } from "../components/SEOComponents";
import { usePagination } from "../hooks/usePagination";
import { fetchTreeProjects } from "../utils/apiData";

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaign, setCampaign] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const itemsPerPage = 12;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTreeProjects()
      .then((data) => {
        if (!active) return;
        setCampaigns(data);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setCampaigns([]);
        setError("We could not load campaigns. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const campaignId = params.get("campaignId");
    if (!campaignId) {
      setIsModalOpen(false);
      return;
    }
    const selectedCampaign = campaigns.find(
      (item) => String(item.id) === String(campaignId)
    );
    if (selectedCampaign) {
      setCampaign(selectedCampaign);
      setIsModalOpen(true);
    }
  }, [location.search, campaigns]);

  const chooseCampaign = (selected) => {
    navigate(`?campaignId=${selected.id}`);
  };

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedData,
    goToPage,
  } = usePagination(campaigns, itemsPerPage);

  return (
    <>
      <CampaignsPageSEO />
      <div className="min-h-[100dvh] bg-background flex flex-col overflow-x-hidden">
        <header className="sticky top-0 z-50 bg-navbar border-b border-border">
          <Topbar />
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 pb-24 md:pb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground text-center">
            Support live climate projects
          </h1>
          <p className="mt-2 text-center text-muted text-sm sm:text-base">
            These campaigns come from verified tree projects in the Climate Wavers database.
          </p>

          {loading ? (
            <p className="mt-10 text-center text-muted">Loading campaigns...</p>
          ) : error ? (
            <div className="mt-10 max-w-md mx-auto text-center border border-border bg-surface p-6">
              <p className="text-foreground font-medium">{error}</p>
              <button
                type="button"
                className="mt-4 h-10 px-4 bg-primary text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="mt-10 max-w-md mx-auto text-center border border-border bg-surface p-6">
              <p className="font-medium text-foreground">No campaigns yet</p>
              <p className="mt-2 text-sm text-muted">
                Live tree projects will appear here once they are published.
              </p>
              <Link to="/app/plant-tree" className="inline-flex mt-4 h-10 px-4 items-center bg-primary text-primary-foreground">
                Plant a tree
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedData.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="text-left"
                    onClick={() => chooseCampaign(item)}
                  >
                    <Campaign campaign={item} />
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    className="justify-center"
                  />
                </div>
              )}
            </>
          )}
        </main>
        {isModalOpen && (
          <Modal closeFn={() => setIsModalOpen(false)}>
            <Payment
              campaignId={campaign.id}
              campaignTitle={campaign.title}
              targetAmount={parseInt(campaign.amount, 10) || 0}
            />
          </Modal>
        )}
        <div className="md:hidden">
          <Footer />
        </div>
      </div>
    </>
  );
};

export default CampaignsPage;
