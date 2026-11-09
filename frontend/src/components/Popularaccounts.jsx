import Accountcard from "./Accountcard";
import { usePopularUsers } from "../hooks/usePopularUsers";

const PopularSkeleton = () => (
  <div className="space-y-3 px-3 pb-2">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 max-w-full rounded bg-gray-200" />
            <div className="h-3 w-16 max-w-full rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-full bg-gray-200 flex-shrink-0" />
      </div>
    ))}
  </div>
);

const Popularaccounts = () => {
  const { data: users, isLoading, isFetching, error } = usePopularUsers();

  const displayUsers =
    users && Array.isArray(users) && users.length > 0 ? users.slice(0, 4) : [];

  const showSkeleton = (isLoading || isFetching) && displayUsers.length === 0;

  return (
    <div>
      <div className="flex flex-col gap-1 text-black bg-[#F4F4F4] list-none py-3 m-2 rounded-2xl">
        <div className="flex items-center justify-between px-3 pb-1">
          <h2 className="text-sm sm:text-base font-semibold">Popular accounts</h2>
          {isFetching && displayUsers.length > 0 && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2F4F4F]" />
          )}
        </div>

        {showSkeleton ? (
          <PopularSkeleton />
        ) : displayUsers.length === 0 ? (
          <div className="px-3 pb-3">
            <p className="text-sm text-muted">
              {error ? "We could not load accounts." : "No accounts to suggest yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-1">
            {displayUsers.map((user) => (
              <Accountcard key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Popularaccounts;
