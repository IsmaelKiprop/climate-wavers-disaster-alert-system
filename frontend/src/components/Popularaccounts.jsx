import Accountcard from "./Accountcard";
import { usePopularUsers } from "../hooks/usePopularUsers";

const Popularaccounts = () => {
  const { data: users, isLoading, error } = usePopularUsers();

  // Fallback data for when API is not available or returns empty
  const fallbackUsers = [
    {
      id: "1",
      first_name: "United Nations",
      profile_picture: "../../unn.png",
      username: "unnnigeria",
    },
    {
      id: "2",
      first_name: "Red Cross",
      profile_picture: "../../red.png",
      username: "redcrossng",
    },
    {
      id: "4",
      first_name: "Lawma",
      last_name: "",
      profile_picture: "../../lawma.png",
      username: "lawma",
    },
    {
      id: "3",
      first_name: "UNFCCC",
      last_name: "",
      profile_picture: "../../unfcc.png",
      username: "unfcccnigeria",
    },
  ];

  // Use API data if available, otherwise use fallback
  const displayUsers = (users && Array.isArray(users) && users.length > 0) ? users.slice(0, 4) : fallbackUsers;

  return (
    <div>
      <div className="flex flex-col gap-2 text-black bg-[#F4F4F4] list-none py-3 sm:py-4 m-2 sm:m-4 rounded-2xl">
        <div className="flex items-center justify-between p-3">
          <h2 className="text-base sm:text-lg font-semibold">Popular accounts</h2>
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2F4F4F]"></div>
          )}
        </div>
        
        {error && displayUsers.length === 0 ? (
          <div className="px-3 pb-3">
            <p className="text-sm text-muted">We could not load accounts.</p>
          </div>
        ) : (
          <div className="space-y-1">
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
