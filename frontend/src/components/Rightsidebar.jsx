import Communityselector from "./Communityselector";
import Popularaccounts from "./Popularaccounts";
import OnlinePeople from "./OnlinePeople";

const Rightsidebar = () => {
  return (
    <div className="h-full p-4 space-y-4">
      <OnlinePeople variant="rail" />
      <Communityselector />
      <Popularaccounts />
    </div>
  );
};

export default Rightsidebar;
