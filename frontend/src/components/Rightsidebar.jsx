import Communityselector from "./Communityselector";
import Popularaccounts from "./Popularaccounts";

const Rightsidebar = () => {
  return (
    <div className="h-full p-4 space-y-6">
      <Communityselector />
      <Popularaccounts />
    </div>
  );
};

export default Rightsidebar;
