import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Campaign from "../components/Campaign";
import Topbar from "../components/Topbar";
import Pagination from "../components/Pagination";
import Payment from "../components/Payment";
import Modal from "../components/Modal";
import Footer from "../components/FooterBar";
import DashboardSidebar from "../components/DashboardSidebar";
import Menu from "../components/Menu";
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

  const loadCampaigns = () => {
    setLoading(true);
    fetchTreeProjects()
      .then((data) => {
        setCampaigns(data);
        setError("");
      })
      .catch(() => {
        setCampaigns([]);
        setError("We could not load campaigns. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
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
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <header className="shrink-0 z-50 bg-navbar border-b border-border">
          <Topbar />
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <DashboardSidebar>
            <Menu />
          </DashboardSidebar>
          <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 pb-6 md:pb-8">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
              Support live climate projects
            </h1>
            <p className="mt-1 text-muted text-sm">
              Verified tree campaigns from the Climate Wavers database in Nairobi.
            </p>

            {loading ? (
              <p className="mt-10 text-muted">Loading campaigns...</p>
            ) : error ? (
              <div className="mt-8 max-w-md border border-border bg-surface p-5">
                <p className="font-medium">{error}</p>
                <button
                  type="button"
                  className="mt-4 h-10 px-4 bg-primary text-primary-foreground"
                  onClick={loadCampaigns}
                >
                  Retry
                </button>
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="mt-8 max-w-md border border-border bg-surface p-5">
                <p className="font-medium">No campaigns yet</p>
                <p className="mt-2 text-sm text-muted">
                  Live tree projects will appear here once they are published.
                </p>
                <Link to="/app/plant-tree" className="inline-flex mt-4 h-10 px-4 items-center bg-primary text-primary-foreground">
                  Plant a tree
                </Link>
              </div>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
        </div>
        {isModalOpen && (
          <Modal closeFn={() => setIsModalOpen(false)}>
            <Payment
              campaignId={campaign.id}
              campaignTitle={campaign.title}
              targetAmount={parseInt(campaign.amount, 10) || 0}
            />
          </Modal>
        )}
        <div className="md:hidden shrink-0">
          <Footer />
        </div>
      </div>
    </>
  );
};

export default CampaignsPage;
