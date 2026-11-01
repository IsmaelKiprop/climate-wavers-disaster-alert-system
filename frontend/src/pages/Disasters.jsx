import Disasters from "../components/Disaster";
import DisasterImage from "../components/DisastersImages";
import Topbar from "../components/Topbar";
import Menu from "../components/Menu";
import Footer from "../components/FooterBar";
import Pagination from "../components/Pagination";
import { useEffect, useState } from "react";
import axios from "axios";
import { DisastersPageSEO } from "../components/SEOComponents";
import { usePagination } from "../hooks/usePagination";
import { env, chatbotApiUrl } from "../config/env";

const apiUrl = env.chatbotUrl
  ? chatbotApiUrl("/api/v1/disasters")
  : "/api/v1/disasters";

const DisasterPage = () => {
  const [allDisasters, setAllDisasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 15;

  useEffect(() => {
    setLoading(true);
    
    // Check if we have the external API URL configured
    if (!env.chatbotUrl) {
      console.log('VITE_APP_CHATBOT_URL not configured, using mock data');
      // Use mock data when external API is not available
      const mockDisasters = [
        {
          id: 1,
          region: "California",
          country: "USA",
          disasterType: "Wildfire",
          status: "ongoing",
          startDate: "2024-01-15T00:00:00Z"
        },
        {
          id: 2,
          region: "Queensland",
          country: "Australia",
          disasterType: "Flood",
          status: "alert",
          startDate: "2024-01-10T00:00:00Z"
        },
        {
          id: 3,
          region: "Sicily",
          country: "Italy",
          disasterType: "Earthquake",
          status: "past",
          startDate: "2024-01-05T00:00:00Z"
        }
      ];
      
      setAllDisasters(mockDisasters);
      setLoading(false);
      return;
    }
    
    axios.get(apiUrl)
      .then((res) => {
        const { data } = res;
        setAllDisasters(data?.data || []);
      })
      .catch((error) => {
        console.error('Error fetching disasters:', error);
        console.log('Using fallback mock data');
        
        // Fallback to mock data on API error
        const mockDisasters = [
          {
            id: 1,
            region: "California",
            country: "USA",
            disasterType: "Wildfire",
            status: "ongoing",
            startDate: "2024-01-15T00:00:00Z"
          },
          {
            id: 2,
            region: "Queensland",
            country: "Australia",
            disasterType: "Flood",
            status: "alert",
            startDate: "2024-01-10T00:00:00Z"
          }
        ];
        
        setAllDisasters(mockDisasters);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Use pagination hook
  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedData,
    goToPage,
  } = usePagination(allDisasters, itemsPerPage);

  return (
    <>
      <DisastersPageSEO />
      <div className="w-full overflow-hidden">
      <div className="md:pb-20 pb-12">
        <Topbar />
      </div>

      <div className="flex w-full md:pb-0 pb-8">
        <div className="w-[20%] border-r-2 hidden md:flex ">
          <Menu />
        </div>
        {/* <Mainfeed/> */}
        <div className="md:w-[80vw] w-full px-2  md:items-center">
          <div className="2xl:h-[50vh] md:h-[48vh] h-[45vh] md:mb-28 mb-4 py-2">
            <DisasterImage disasters={paginatedData} />
          </div>
          <div className=" flex">
            <input
              className="bg-graylight-300 h-[60px] placeholder:italic placeholder:text-slate-400 placeholder:px-4 px-2  md:w-[100%] w-[75%] outline-[2px]  border  focus:border-2  focus:outline-2 focus:outline-gray-300 border-gray-200 rounded-lg text-graydark "
              type="text"
              placeholder="🔍 Search disaster keywords"
            />
            <button className="bg-[#067d83]  text-white font-serif border relative md:w-[20%] w-[25%] rounded-lg">
              Search
            </button>
          </div>
          <div>
            <h2 className="font-bold md:mt-8 mt-2 py-4 border-b-2 self-end text-2xl  text-[#434343] leading-4 border-gray-300">
              {loading ? (
                "Loading disasters..."
              ) : paginatedData.length > 0 ? (
                `Showing ${paginatedData.length} of ${totalItems} results`
              ) : (
                "No disasters found"
              )}
            </h2>
          </div>
          <Disasters disasters={paginatedData} />
          
          {/* Pagination */}
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
        </div>
      </div>
      <div className="md:hidden">
        <Footer />
      </div>
      </div>
    </>
  );
};

export default DisasterPage;
