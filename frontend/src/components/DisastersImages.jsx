import PropTypes from "prop-types";
import { Link } from "react-router-dom";

const DisasterImages = ({ disasters }) => {
  // Handle undefined or null disasters array
  if (!disasters || !Array.isArray(disasters)) {
    return (
      <div className="flex md:py-8 py-4 max-w-screen overflow-x-auto">
        <div className="px-4">
          <p className="text-gray-500">No disaster data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex md:py-8 py-4 max-w-screen overflow-x-auto">
      {disasters.map((disaster) => (
        <div key={disaster.id} className=" px-4">
          <img
            alt=""
            className="border-2 rounded-xl shadow-2xl md:min-w-[35vw] h-[70%]  shadow-gray-400 min-w-[90vw] "
            src={
              disaster.images?.length ? disaster.images[0] : '/placeholde-disaster-img.jpg'
            }
          />
          <div className="text-white relative px-8 bottom-[55%]">
            <span className="relative font-semibold md:bottom-[5rem] text-xl">
              Trending Now
            </span>
            <h2 className="font-bold  text-2xl ">
              {disaster.region}, {disaster.country} - {disaster.disasterType}
            </h2>
            <p className="h-[60px] py-4 md:text-xl md:h-fit md:max-h-[150px] overflow-hidden">{disaster.details}</p>
            <Link to={`/disasters/${encodeURIComponent(disaster.id)}`}>
              <button className="rounded-lg bg-[#2F4F4F] w-fit h-12 my-2 px-4">
                {" "}
                See details
              </button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
};

DisasterImages.propTypes = {
  disasters: PropTypes.array,
};

export default DisasterImages;
