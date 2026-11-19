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

  const runVerify = async (reference) => {
    let stored = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(`cw-pay-${reference}`) || '{}') || {};
    } catch {
      stored = {};
    }
    const productFromUrl = (searchParams.get('product') || '').trim().toLowerCase();
    if (productFromUrl && !stored.product) {
      stored.product = productFromUrl;
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
    const details = result.certificate_data || {};
    const isPlastic =
      (result.product || stored.product || '').toString().toLowerCase() === 'plastic';
    setPaymentData({
      reference,
      amount: Number(details.amount || result.amount_usd || 0),
      trees: Number(details.trees_planted || 1),
      kgSponsored: Number(result.kg_sponsored || stored.kg_sponsored || 0),
      product: isPlastic ? 'plastic' : 'tree',
      certificateId: details.certificate_id || result.certificate_id || '',
      certificateEmailed: Boolean(
        result.certificate_emailed_at || details.emailed
      ),
      donorEmail: details.payer_email || '',
      species: details.species || details.tree_type || '',
      giftedTo: details.gifted_to || '',
      projectId: result.project_id || stored.plastic_project_id || stored.project_id,
    });
    setError('');
    sessionStorage.removeItem(`cw-pay-${reference}`);
    toast.success(
      isPlastic
        ? 'Plastic sponsorship saved. Your impact certificate is ready.'
        : result.certificate_emailed_at || details.emailed
          ? 'Payment saved. Your tree certificate is on its way by email.'
          : 'Payment saved. Your trees are on your dashboard.'
    );
  };

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
        await runVerify(reference);
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

  const handleRetry = async () => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) return;
    setLoading(true);
    setError('');
    try {
      await runVerify(reference);
    } catch (verifyError) {
      setError(verifyError.message || 'Payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

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
                <>
                  <p className="text-sm text-gray-500 mt-3">
                    Paystack already confirmed the charge (ref{' '}
                    <span className="font-mono">
                      {searchParams.get('reference') || searchParams.get('trxref')}
                    </span>
                    ). Retry saving it to update project impact.
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-[#067d83] text-white text-sm font-medium"
                  >
                    Retry save to Climate Wavers
                  </button>
                </>
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
                
                {paymentData.product === 'plastic' ? (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Plastic sponsored:</span>
                    <span className="font-semibold text-green-600">
                      {paymentData.kgSponsored || 0} kg
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Trees Planted:</span>
                    <span className="font-semibold text-green-600">
                      {paymentData.trees} tree{paymentData.trees > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">
                    KSh {paymentData.amount.toLocaleString()}
                  </span>
                </div>
                {paymentData.species ? (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Species:</span>
                    <span className="font-medium text-right max-w-[60%]">
                      {paymentData.species}
                    </span>
                  </div>
                ) : null}
                {paymentData.certificateId ? (
                  <div className="flex justify-between items-center py-2 gap-3">
                    <span className="text-gray-600 shrink-0">Certificate ID:</span>
                    <button
                      type="button"
                      className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-left hover:underline"
                      onClick={() =>
                        navigate(
                          paymentData.product === 'plastic'
                            ? `/verify/plastic/${encodeURIComponent(paymentData.certificateId)}`
                            : `/verify/tree/${encodeURIComponent(paymentData.certificateId)}`
                        )
                      }
                    >
                      {paymentData.certificateId}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {paymentData && (<>
          <div className="bg-white border border-[#067d83]/30 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <IoLeaf className="w-5 h-5 text-[#067d83] mr-2" />
              Your branded certificate
            </h3>
            {paymentData.certificateEmailed ? (
              <p className="text-gray-600 text-sm">
                A Climate Wavers certificate PDF was emailed
                {paymentData.donorEmail ? (
                  <>
                    {' '}to <span className="font-medium">{paymentData.donorEmail}</span>
                  </>
                ) : (
                  ' to you'
                )}
                . Check inbox and spam — you can also re-download from your dashboard when signed in.
              </p>
            ) : (
              <p className="text-gray-600 text-sm">
                Your certificate is being prepared and will arrive by email shortly
                {paymentData.donorEmail ? (
                  <>
                    {' '}at <span className="font-medium">{paymentData.donorEmail}</span>
                  </>
                ) : null}
                . ID: <span className="font-mono text-xs">{paymentData.certificateId || 'pending'}</span>
              </p>
            )}
          </div>

          <div className="bg-[#067d83] text-white p-6 mb-8">
            <h3 className="text-xl font-semibold mb-3 flex items-center">
              <IoLeaf className="w-6 h-6 mr-2" />
              Your Impact
            </h3>
            <p className="text-white/90 mb-4">
              {paymentData.product === 'plastic'
                ? `By sponsoring ${paymentData.kgSponsored || 0} kg of verified plastic recovery, you help:`
                : `By planting ${paymentData?.trees || 1} tree${paymentData?.trees > 1 ? 's' : ''}${
                    paymentData.giftedTo ? ` for ${paymentData.giftedTo}` : ''
                  }, you help:`}
            </p>
            <ul className="space-y-2 text-white/90">
              {paymentData.product === 'plastic' ? (
                <>
                  <li className="flex items-center">
                    <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                    Fund CBO / youth collection above scrap value
                  </li>
                  <li className="flex items-center">
                    <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                    Clear drain corridors that raise flood risk
                  </li>
                  <li className="flex items-center">
                    <IoCheckmarkCircle className="w-4 h-4 mr-2 text-white" />
                    Keep recyclable material in the circular economy
                  </li>
                </>
              ) : (
                <>
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
                </>
              )}
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <IoTime className="w-5 h-5 text-[#067d83] mr-2" />
              What&apos;s next?
            </h3>
            <div className="space-y-3 text-gray-600">
              {paymentData.product === 'plastic' ? (
                <>
                  <p>• Plastic impact certificate is ready to verify by code</p>
                  <p>• CBO receives sponsorship share for verified recovery ops</p>
                  <p>• Live kg updates on the public Plastic Pulse project page</p>
                  <p>• Earn Wavers Points (10% of sponsored USD) when signed in</p>
                </>
              ) : (
                <>
                  <p>• Certificate email with PNG attachment (Climate Wavers + FlowOps)</p>
                  <p>• Trees planted with the project team — typically within 30 days</p>
                  <p>• Tree Admin org gets a payment notice for their project</p>
                  <p>• Track impact from your Climate Wavers dashboard</p>
                </>
              )}
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
              onClick={() => {
                if (paymentData?.product === 'plastic' && paymentData?.projectId) {
                  navigate(`/plastic/${paymentData.projectId}`);
                } else if (paymentData?.product === 'plastic' && paymentData?.certificateId) {
                  navigate(`/verify/plastic/${encodeURIComponent(paymentData.certificateId)}`);
                } else {
                  handleViewProjects();
                }
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <IoLeaf className="w-5 h-5 mr-2" />
              {paymentData?.product === 'plastic' ? 'View Plastic Project' : 'Plant More Trees'}
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
