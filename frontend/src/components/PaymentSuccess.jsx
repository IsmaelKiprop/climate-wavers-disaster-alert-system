import { useState, useEffect } from 'react';
import { FaTree, FaCheckCircle, FaDownload, FaShare, FaHeart } from 'react-icons/fa';
import TreeCertificate from './TreeCertificate';

const PaymentSuccess = ({ paymentData, onClose }) => {
  const [showCertificate, setShowCertificate] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDownloadCertificate = () => {
    setShowCertificate(true);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'I just planted a tree! 🌳',
        text: `I just planted a ${paymentData.project_name} tree in ${paymentData.project_location}. Join me in making the world greener!`,
        url: window.location.origin
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      const shareText = `I just planted a ${paymentData.project_name} tree in ${paymentData.project_location}. Join me in making the world greener! ${window.location.origin}`;
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Share text copied to clipboard!');
      });
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Success Animation */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-white bg-opacity-10"></div>
            <div className="relative z-10">
              {/* Animated Checkmark */}
              <div className={`mx-auto mb-6 w-20 h-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center transition-all duration-1000 ${animationComplete ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                <FaCheckCircle className="text-4xl text-white" />
              </div>
              
              {/* Animated Tree Icon */}
              <div className={`mx-auto mb-4 transition-all duration-1000 delay-300 ${animationComplete ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                <FaTree className="text-6xl text-white" />
              </div>
              
              <h2 className={`text-2xl font-bold mb-2 transition-all duration-1000 delay-500 ${animationComplete ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                Payment Successful! 🎉
              </h2>
              <p className={`text-green-100 transition-all duration-1000 delay-700 ${animationComplete ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {paymentData.certificate_emailed
                  ? 'Certificate emailed — trees are on their way.'
                  : 'Your tree will be planted soon!'}
              </p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Thank you for your contribution! 🌱
              </h3>
              <p className="text-gray-600">
                {paymentData.certificate_emailed
                  ? 'A branded Climate Wavers certificate was sent to your email (check spam too).'
                  : 'Your tree planting is confirmed. A certificate email follows shortly.'}
              </p>
              {paymentData.certificate_id || paymentData.certificateId ? (
                <p className="mt-2 font-mono text-xs text-gray-500">
                  ID {paymentData.certificateId || paymentData.certificate_id}
                </p>
              ) : null}
            </div>

            {/* Project Details */}
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                <FaTree className="mr-2" />
                Your Tree Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Project:</span>
                  <span className="font-medium">{paymentData.project_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{paymentData.project_location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trees Planted:</span>
                  <span className="font-medium">{paymentData.trees_planted}</span>
                </div>
                {paymentData.selected_species && Object.keys(paymentData.selected_species).length > 0 && (
                  <div className="mt-2">
                    <span className="text-gray-600 text-sm">Species Selected:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(paymentData.selected_species).map(([species, quantity]) => (
                        quantity > 0 && (
                          <div key={species} className="flex justify-between text-sm">
                            <span className="text-gray-600">{species}:</span>
                            <span className="font-medium">{quantity}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">${paymentData.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{paymentData.date}</span>
                </div>
              </div>
            </div>

            {/* Dedication Message */}
            {paymentData.dedication_message && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                  <FaHeart className="mr-2" />
                  Your Dedication
                </h4>
                <p className="text-blue-700 italic">"{paymentData.dedication_message}"</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleDownloadCertificate}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center"
              >
                <FaDownload className="mr-2" />
                Download Certificate
              </button>
              
              <button
                onClick={handleShare}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
              >
                <FaShare className="mr-2" />
                Share Your Impact
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Continue Planting Trees
              </button>
            </div>

            {/* Impact Message */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                🌍 You're making a real difference in the fight against climate change!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate Modal */}
      {showCertificate && (
        <TreeCertificate
          isOpen={showCertificate}
          onClose={() => setShowCertificate(false)}
          certificateData={paymentData}
          onDownload={() => {
            console.log('Certificate downloaded');
            setShowCertificate(false);
          }}
          onShare={() => {
            console.log('Certificate shared');
            setShowCertificate(false);
          }}
        />
      )}
    </>
  );
};

export default PaymentSuccess;
