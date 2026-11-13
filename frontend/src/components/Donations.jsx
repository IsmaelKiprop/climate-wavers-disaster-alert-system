import { useState } from 'react';
import Payment from './Payment';

const Donations = () => {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  const campaigns = [
    {
      id: 1,
      title: "Rise Above the Floods",
      description: "Emergency relief for families impacted by devastating floods",
      targetAmount: 15000,
      raisedAmount: 10000,
      image: "/campaign2.png"
    },
    {
      id: 2,
      title: "Wildfire Relief: Healing the Earth",
      description: "Replanting trees and rehabilitating ecosystems affected by wildfires",
      targetAmount: 20000,
      raisedAmount: 16000,
      image: "/campaign1.png"
    },
    {
      id: 3,
      title: "Volcano Resilience: Rebuilding Lives",
      description: "Immediate relief, long-term recovery, and education on volcanic safety",
      targetAmount: 50000,
      raisedAmount: 32000,
      image: "/campaign4.png"
    }
  ];

  const getProgressPercentage = (raised, target) => {
    return Math.min((raised / target) * 100, 100);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Support Climate Wavers
          </h1>
          <p className="text-xl text-gray-600">
            Fuel WhatsApp + email alerts, or back a verified planting campaign
          </p>
        </div>

        {selectedCampaign ? (
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setSelectedCampaign(null)}
              className="mb-6 text-[#2F4F4F] hover:text-[#1F3F3F] font-medium"
            >
              ← Back to Campaigns
            </button>
            <Payment
              campaignId={selectedCampaign.id}
              campaignTitle={selectedCampaign.title}
              targetAmount={selectedCampaign.targetAmount}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <img
                  src={campaign.image}
                  alt={campaign.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {campaign.title}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {campaign.description}
                  </p>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Raised: ${campaign.raisedAmount.toLocaleString()}</span>
                      <span>Target: ${campaign.targetAmount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#2F4F4F] h-2 rounded-full"
                        style={{
                          width: `${getProgressPercentage(campaign.raisedAmount, campaign.targetAmount)}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {getProgressPercentage(campaign.raisedAmount, campaign.targetAmount).toFixed(1)}% funded
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    className="w-full bg-[#2F4F4F] text-white py-2 px-4 rounded-md hover:bg-[#1F3F3F] transition-colors"
                  >
                    Support this campaign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Donations;
