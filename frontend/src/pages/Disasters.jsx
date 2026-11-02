import Disasters from "../components/Disaster";
import DisasterImage from "../components/DisastersImages";
import Topbar from "../components/Topbar";
import Menu from "../components/Menu";
import Footer from "../components/FooterBar";
import Pagination from "../components/Pagination";
import { useEffect, useMemo, useState } from "react";
import { DisastersPageSEO } from "../components/SEOComponents";
import { usePagination } from "../hooks/usePagination";
import { fetchDisasters } from "../utils/apiData";

const DisasterPage = () => {
  const [allDisasters, setAllDisasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const itemsPerPage = 15;

  const loadDisasters = () => {
    setLoading(true);
    fetchDisasters()
      .then((data) => {
        setAllDisasters(data);
        setError("");
      })
      .catch(() => {
        setAllDisasters([]);
        setError("We could not load disaster reports. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDisasters();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allDisasters;
    return allDisasters.filter((disaster) =>
      [disaster.region, disaster.country, disaster.disasterType, disaster.status, disaster.details]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [allDisasters, query]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedData,
    goToPage,
  } = usePagination(filtered, itemsPerPage);

  return (
    <>
      <DisastersPageSEO />
      <div className="min-h-[100dvh] bg-background flex flex-col overflow-x-hidden">
        <header className="sticky top-0 z-50 bg-navbar border-b border-border">
          <Topbar />
        </header>
        <div className="flex flex-1">
          <aside className="hidden md:block w-[220px] lg:w-[240px] bg-sidebar border-r border-border sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto shrink-0">
            <div className="p-4">
              <Menu />
            </div>
          </aside>
          <main className="flex-1 min-w-0 px-3 sm:px-4 py-4 pb-24 md:pb-8">
            <div className="h-44 sm:h-56 mb-4 overflow-hidden border border-border bg-surface">
              <DisasterImage disasters={paginatedData} />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <label htmlFor="disaster-search" className="sr-only">Search disasters</label>
              <input
                id="disaster-search"
                className="h-11 flex-1 px-3 border border-border bg-surface"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by country, type, or status"
              />
              <button type="submit" className="h-11 px-4 bg-primary text-primary-foreground shrink-0">
                Search
              </button>
            </form>
            <h2 className="font-semibold mt-6 py-3 border-b border-border text-lg text-foreground">
              {loading
                ? "Loading disasters..."
                : paginatedData.length > 0
                  ? `Showing ${paginatedData.length} of ${totalItems} reports`
                  : "No disasters found"}
            </h2>
            {error ? (
              <div className="mt-6 max-w-md border border-border bg-surface p-5">
                <p className="font-medium">{error}</p>
                <button type="button" className="mt-4 h-10 px-4 bg-primary text-primary-foreground" onClick={loadDisasters}>
                  Retry
                </button>
              </div>
            ) : (
              <Disasters disasters={paginatedData} />
            )}
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
          </main>
        </div>
        <div className="md:hidden">
          <Footer />
        </div>
      </div>
    </>
  );
};

export default DisasterPage;
