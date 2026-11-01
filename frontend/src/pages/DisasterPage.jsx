import { useParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import Menu from "../components/Menu";
import Createcomment from "../components/Createcomment";
import { useEffect, useState } from "react";
import axios from "axios";
import { env, chatbotApiUrl } from "../config/env";

const apiUrl = env.chatbotUrl
  ? chatbotApiUrl("/api/v1/disasters")
  : "/api/v1/disasters";

const DisasterPage = () => {
  const { disasterId } = useParams();

  const [disaster, setDisaster] = useState();
  useEffect(() => {
    // Check if we have the external API URL configured
    if (!env.chatbotUrl) {
      console.log('VITE_APP_CHATBOT_URL not configured, using mock data');
      // Use mock data when external API is not available
      const mockDisaster = {
        id: disasterId,
        region: "California",
        country: "USA",
        disasterType: "Wildfire",
        status: "ongoing",
        startDate: "2024-01-15T00:00:00Z",
        description: "Large wildfire affecting multiple counties in California"
      };
      setDisaster(mockDisaster);
      return;
    }
    
    axios
      .get(apiUrl + "/" + disasterId)
      .then((res) => {
        const { data } = res;
        setDisaster(data);
      })
      .catch((err) => {
        console.log('Error fetching disaster details:', err);
        // Fallback to mock data
        const mockDisaster = {
          id: disasterId,
          region: "California",
          country: "USA",
          disasterType: "Wildfire",
          status: "ongoing",
          startDate: "2024-01-15T00:00:00Z",
          description: "Large wildfire affecting multiple counties in California"
        };
        setDisaster(mockDisaster);
      });
  }, [disasterId]);

  return (
    <div className="w-full overflow-hidden">
      <div className="md:pb-20 pb-10">
        <Topbar />
      </div>

      <div className="flex w-full md:py-0 py-8">
        <div className="w-[20%] fixed border-r-2 h-full hidden md:flex ">
          <Menu />
        </div>
        <div className="px-4 py-4 md:pl-[21%] grid gap-y-4">
          <h2 className="capitalize font-bold  md:text-2xl text-xl">
            {disaster?.region}, {disaster?.country}: {disaster?.disasterType} -{" "}
            {disaster?.startDate && formatDate(disaster.startDate)}
          </h2>
          <h3 className="capitalize text-[#067d83] md:text-xl font-semibold">
            Description
          </h3>
          <div
            className="md:text-xl text-md font-serif"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {disaster?.details}
          </div>
          <img
            alt="disaster_image"
            className="border-2 shadow-md rounded-md"
            src={
              disaster?.images?.length
                ? disaster.images[0]
                : "/placeholde-disaster-img.jpg"
            }
          />
          <h4 className="py-2 font-semibold text-[#067d83] text-xl">
            Comments
          </h4>

          <div className=" md:border-2 border-b-2 border-t-0 self-center rounded-lg shadow-xl shadow-white h-40 py-4 ">
            <Createcomment
              type={"comments"}
              button={"comment"}
            />
          </div>
         
        </div>
      </div>
    </div>
  );
};

function formatDate(d) {
  const date = new Date(d);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return formattedDate;
}

export default DisasterPage;
