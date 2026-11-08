import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  IoCheckmarkCircle, 
  IoLeaf, 
  IoHome, 
  IoArrowBack,
  IoTime,
  IoAlertCircle
} from 'react-icons/io5';
import { apiUrl } from '../config/env';
import { getAuthToken } from '../utils/factory';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) {
      setError('Paystack did not return a payment reference.');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const verify = async () => {
      try {
        let stored = {};
        try {
          stored = JSON.parse(sessionStorage.getItem(`cw-pay-${reference}`) || '{}') || {};
        } catch {
          stored = {};
        }
        const token = getAuthToken();
        const response = await fetch(apiUrl('/api/v1/verify-payment/'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reference, ...stored }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Payment verification failed.');
        }
        if (cancelled) return;
        const details = result.certificate_data || {};
        setPaymentData({
          reference,
          amount: Number(details.amount || 0),
          trees: Number(details.trees_planted || 1),
        });
        sessionStorage.removeItem(`cw-pay-${reference}`);
        toast.success('Payment saved. Your trees are on your dashboard.');
      } catch (verifyError) {
        if (!cancelled) {
          setError(verifyError.message || 'Payment verification failed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleGoHome = () => {
    navigate('/app');
  };

  const handleViewProjects = () => {
    navigate('/app/plant-tree');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f7]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {paymentData && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <IoCheckmarkCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Payment Successful
            </h1>
            <p className="text-lg text-gray-600">
              Thank you for contributing to climate action.
            </p>
          </div>
          )}

          {error && (
            <div className="bg-white border border-red-200 p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                <IoAlertCircle className="w-5 h-5 text-red-600 mr-2" />
                Payment received, not saved yet
              </h2>
              <p className="text-gray-600">{error}</p>
              {(searchParams.get('reference') || searchParams.get('trxref')) && (
                <p className="text-sm text-gray-500 mt-3">
                  Paystack already confirmed the charge. Sign in with the same email and open this page again, or contact support with your payment reference.
                </p>
              )}
            </div>
          )}

          {/* Payment Details */}
          {paymentData && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <IoLeaf className="w-5 h-5 text-green-600 mr-2" />
                Payment Details
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Reference:</span>
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    {paymentData.reference}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Trees Planted:</span>
                  <span className="font-semibold text-green-600">
                    {paymentData.trees} tree{paymentData.trees > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">
                    KSh {paymentData.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {paymentData && (<>
          {/* Impact Message */}
          <div className="bg-[#067d83] rounded-xl text-white p-6 mb-8">
            <h3 className="text-xl font-semibold mb-3 flex items-center">
              <IoLeaf className="w-6 h-6 mr-2" />
              Your Impact
            </h3>
            <p className="text-white/90 mb-4">
              By planting {paymentData?.trees || 1} tree{paymentData?.trees > 1 ? 's' : ''}, you're helping to:
            </p>
            <ul className="space-y-2 text-white/90">
              <li className="flex items-center">
                <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                Absorb CO₂ from the atmosphere
              </li>
              <li className="flex items-center">
                <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                Restore degraded ecosystems
              </li>
              <li className="flex items-center">
                <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                Support local communities
              </li>
              <li className="flex items-center">
                <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                Combat climate change
              </li>
            </ul>
          </div>

          {/* Next Steps */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <IoTime className="w-5 h-5 text-blue-600 mr-2" />
              What's Next?
            </h3>
            <div className="space-y-3 text-gray-600">
              <p>• You'll receive a confirmation email shortly</p>
              <p>• Your trees will be planted within 30 days</p>
              <p>• You'll get updates on your tree's growth</p>
              <p>• Track your environmental impact in your profile</p>
            </div>
          </div>
          </>)}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGoHome}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <IoHome className="w-5 h-5 mr-2" />
              Go to Dashboard
            </button>
            
            <button
              onClick={handleViewProjects}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <IoLeaf className="w-5 h-5 mr-2" />
              Plant More Trees
            </button>
          </div>

          {/* Back Button */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-500 hover:text-gray-700 flex items-center justify-center mx-auto"
            >
              <IoArrowBack className="w-4 h-4 mr-1" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
