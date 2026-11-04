import { Link } from "react-router-dom";
import Topbar from "../components/Topbar";
import Menu from "../components/Menu";
import DashboardSidebar from "../components/DashboardSidebar";
import Footer from "../components/FooterBar";
import Pagination from "../components/Pagination";
import { useMemo, useState } from "react";
import { DisastersPageSEO } from "../components/SEOComponents";
import { usePagination } from "../hooks/usePagination";
import { useLiveDisasters } from "../hooks/useLiveDisasters";
import { formatTimeAgo } from "../utils/apiData";

const statusClass = {
  ongoing: "text-destructive",
  alert: "text-warning",
  warning: "text-warning",
  past: "text-muted",
  resolved: "text-muted",
  contained: "text-muted",
};

const DisasterPage = () => {
  const { data: allDisasters = [], isLoading, isFetching, isError, refetch } = useLiveDisasters();
  const [query, setQuery] = useState("");
  const itemsPerPage = 15;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allDisasters;
    return allDisasters.filter((disaster) =>
      [disaster.region, disaster.country, disaster.disasterType, disaster.status, disaster.details, disaster.name, disaster.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [allDisasters, query]);

  const { currentPage, totalPages, totalItems, paginatedData, goToPage } = usePagination(
    filtered,
    itemsPerPage
  );

  return (
    <>
      <DisastersPageSEO />
      <div className="min-h-[100dvh] bg-background flex flex-col overflow-x-hidden">
        <header className="sticky top-0 z-50 bg-navbar border-b border-border">
          <Topbar />
        </header>
        <div className="flex flex-1 min-h-0">
          <DashboardSidebar>
            <Menu />
          </DashboardSidebar>
          <main className="flex-1 min-w-0 px-3 sm:px-5 py-5 pb-24 md:pb-8">
            <div className="max-w-4xl mx-auto">
              <div className="mb-5">
                <p className="text-sm text-muted">Live USGS and NASA events</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-1">
                  Disaster alerts
                </h1>
              </div>

              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  goToPage(1);
                }}
              >
                <label htmlFor="disaster-search" className="sr-only">
                  Search disasters
                </label>
                <input
                  id="disaster-search"
                  className="h-11 flex-1 px-3 border border-border bg-surface text-foreground"
                  style={{ borderRadius: 5 }}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    goToPage(1);
                  }}
                  placeholder="Search by country, type, or status"
                />
                <button
                  type="submit"
                  className="h-11 px-4 bg-primary text-primary-foreground shrink-0"
                  style={{ borderRadius: 5 }}
                >
                  Search
                </button>
              </form>

              <div className="mt-5 mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {isLoading && !paginatedData.length
                    ? "Loading alerts…"
                    : totalItems > 0
                      ? `Showing ${paginatedData.length} of ${totalItems} reports`
                      : "No disasters found"}
                  {isFetching && paginatedData.length ? " · Updating" : ""}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-sm text-primary hover:text-primary-dark"
                >
                  Refresh
                </button>
              </div>

              {isError && !paginatedData.length ? (
                <div className="border border-border bg-surface p-5" style={{ borderRadius: 5 }}>
                  <p className="font-medium text-foreground">We could not load disaster reports.</p>
                  <button
                    type="button"
                    className="mt-4 h-10 px-4 bg-primary text-primary-foreground"
                    style={{ borderRadius: 5 }}
                    onClick={() => refetch()}
                  >
                    Retry
                  </button>
                </div>
              ) : isLoading && !paginatedData.length ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-28 border border-border bg-surface animate-pulse"
                      style={{ borderRadius: 5 }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedData.map((disaster) => {
                    const title =
                      disaster.name ||
                      disaster.title ||
                      [disaster.region, disaster.country].filter(Boolean).join(", ") ||
                      disaster.disasterType;
                    const when = formatTimeAgo(disaster.startDate || disaster.updatedAt);
                    return (
                      <article
                        key={disaster.id}
                        className="border border-border bg-surface p-4 sm:p-5"
                        style={{ borderRadius: 5 }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-muted">
                              {disaster.disasterType || "Alert"}
                              {when ? ` · ${when}` : ""}
                            </p>
                            <h2 className="mt-1 text-lg sm:text-xl font-semibold text-foreground capitalize">
                              {title}
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <p className={statusClass[disaster.status] || "text-foreground"}>
                                <span className="text-muted">Status:</span>{" "}
                                {disaster.status || "undetermined"}
                              </p>
                              {disaster.country ? (
                                <p>
                                  <span className="text-muted">Country:</span> {disaster.country}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Link
                            to={`/disasters/${encodeURIComponent(disaster.id)}`}
                            className="inline-flex items-center justify-center h-10 px-4 border border-border text-sm font-medium text-foreground hover:bg-background shrink-0"
                            style={{ borderRadius: 5 }}
                          >
                            View details
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 ? (
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
              ) : null}
            </div>
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
