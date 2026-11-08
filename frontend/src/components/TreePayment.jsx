import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaTree, FaLeaf, FaGlobe, FaArrowLeft } from 'react-icons/fa';
import TreeCertificate from './TreeCertificate';
import PaymentSuccess from './PaymentSuccess';
import { apiUrl } from '../config/env';
import { getAuthToken, getUser } from '../utils/factory';

const TreePayment = ({ treeData, onSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [dedicationMessage, setDedicationMessage] = useState('');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(true);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateData, setCertificateData] = useState(null);
  const [downloadedCertificates, setDownloadedCertificates] = useState(new Set());
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [selectedSpecies, setSelectedSpecies] = useState({});
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  // Currency configuration
  const currencyConfig = {
    USD: { symbol: '$', code: 'USD' },
    NGN: { symbol: '₦', code: 'NGN' },
    GHS: { symbol: '₵', code: 'GHS' },
    KES: { symbol: 'KSh', code: 'KES' }
  };

  // Default to KES for test mode, can be changed to other currencies for production
  // To switch to other currencies for production, change to: currencyConfig.NGN, currencyConfig.USD, etc.
  const selectedCurrency = currencyConfig.KES;

  // Calculate total quantity and amount
  useEffect(() => {
    const quantities = Object.values(selectedSpecies);
    const total = quantities.reduce((sum, qty) => sum + (qty || 0), 0);
    setTotalQuantity(total);
    setTotalAmount(total * treeData.price);
  }, [selectedSpecies, treeData.price]);

  // Recalculate exchange rate when total amount changes
  useEffect(() => {
    if (exchangeRate && totalAmount > 0) {
      const converted = totalAmount * exchangeRate;
      setConvertedAmount(converted);
    }
  }, [totalAmount, exchangeRate]);

  // Handle species quantity change
  const handleSpeciesQuantityChange = (species, quantity) => {
    setSelectedSpecies(prev => ({
      ...prev,
      [species]: Math.max(0, parseInt(quantity) || 0)
    }));
  };

  // Get available tree species from project data
  const availableSpecies = treeData.tree_species || [];

  // Fetch exchange rate
  const fetchExchangeRate = async () => {
    setLoadingExchangeRate(true);
    try {
      // Use environment variable or fallback to hardcoded URL
      const apiUrl = import.meta.env.VITE_EXCHANGE_RATE_API_URL || 'https://v6.exchangerate-api.com/v6/ee458d7d826fdfbd0b1ec343/latest/USD';
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.result === 'success') {
        const usdToKesRate = data.conversion_rates.KES;
        setExchangeRate(usdToKesRate);
        
        // Convert USD total amount to KES (use treeData.price as fallback)
        const amountToConvert = totalAmount > 0 ? totalAmount : treeData.price;
        const converted = amountToConvert * usdToKesRate;
        setConvertedAmount(converted);
        
        console.log(`Exchange rate: 1 USD = ${usdToKesRate} KES`);
        console.log(`Converted amount: $${amountToConvert} = KSh${converted.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      // Fallback to approximate rate if API fails
      setExchangeRate(150); // Approximate USD to KES rate
      setConvertedAmount(treeData.price * 150);
    } finally {
      setLoadingExchangeRate(false);
    }
  };

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    if (user.email) setEmail(user.email);
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    if (name) setDonorName(name);
  }, []);

  // Load Paystack script and fetch exchange rate
  useEffect(() => {
    // Fetch exchange rate
    fetchExchangeRate();
    
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      console.log('Paystack script loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load Paystack script');
      toast.error('Payment system failed to load. Please refresh the page.');
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Paystack configuration
  const config = {
    reference: (new Date()).getTime().toString(),
    email: email,
    amount: treeData.price * 100, // Convert to cents for Paystack
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_your_public_key_here',
    metadata: {
      custom_fields: [
        {
          display_name: "Tree Type",
          variable_name: "tree_type",
          value: treeData.name
        },
        {
          display_name: "Planting Location",
          variable_name: "planting_location",
          value: treeData.plantingLocation
        },
        {
          display_name: "Donor Name",
          variable_name: "donor_name",
          value: donorName
        },
        {
          display_name: "Dedication Message",
          variable_name: "dedication_message",
          value: dedicationMessage
        }
      ]
    }
  };

  const onPaymentSuccess = async (reference) => {
    console.log('Payment successful:', reference);
    
    try {
      // Verify payment with backend
      const paymentData = {
        reference: reference,
        project_id: treeData.id,
        amount: convertedAmount, // Send the converted KES amount
        trees_purchased: totalQuantity,
        donor_name: donorName,
        dedication_message: dedicationMessage,
        selected_species: selectedSpecies
      };
      
      // Send payment verification to backend
      
      const token = getAuthToken();
      const response = await fetch(apiUrl('/api/v1/verify-payment/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(paymentData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('🌱 Payment verified! Your tree will be planted soon.');
        
        // Set payment success data
        const successData = {
          project_name: treeData.name,
          project_location: treeData.plantingLocation,
          trees_planted: totalQuantity,
          amount: totalAmount,
          date: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          dedication_message: dedicationMessage || '',
          donor_name: donorName || 'Anonymous',
          selected_species: selectedSpecies
        };
        
        setPaymentSuccessData(successData);
        setShowPaymentSuccess(true);
        
        // Update user's total trees planted for badge system
        if (result.user_total_trees !== undefined) {
          // Dispatch event to update TreeBadge components
          window.dispatchEvent(new CustomEvent('userTreesUpdated', {
            detail: { trees_planted: result.user_total_trees }
          }));
        }
    
        const treeWithPayment = {
          ...treeData,
          paymentReference: reference,
          donorName: donorName || 'Anonymous',
          dedicationMessage: dedicationMessage || 'For a greener future'
        };
        
        onSuccess(treeWithPayment, reference);
      } else {
        toast.error('❌ Payment verification failed. Please contact support.');
        console.error('Payment verification failed:', result.message);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast.error('❌ Error verifying payment. Please contact support.');
    }
  };

  const onClose = () => {
    console.log('Payment closed');
    setLoading(false);
  };

  const handlePayment = () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    if (!donorName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (totalQuantity === 0) {
      toast.error('Please select at least one tree to plant');
      return;
    }

    // Check if Paystack is loaded
    if (!window.PaystackPop) {
      toast.error('Payment system not ready. Please refresh the page and try again.');
      return;
    }

    // Check if we have the converted amount
    if (!convertedAmount) {
      toast.error('Exchange rate not loaded. Please wait a moment and try again.');
      return;
    }

    setLoading(true);

    // Use environment variable or fallback to test key
    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a';
    
    // Debug: Log the configuration
    console.log('Paystack Configuration:', {
      key: paystackKey,
      email: email,
      amount: Math.round(convertedAmount * 100), // KES amount in cents
      currency: 'KES',
      ref: config.reference,
      originalUSD: treeData.price,
      convertedKES: convertedAmount
    });

    // Use Paystack inline script with KES currency
    const checkout = {
      project_id: treeData.id,
      trees_purchased: totalQuantity,
      donor_name: donorName,
      dedication_message: dedicationMessage,
      selected_species: selectedSpecies,
    };
    sessionStorage.setItem(`cw-pay-${config.reference}`, JSON.stringify(checkout));

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: email,
      amount: Math.round(convertedAmount * 100), // Convert KES to cents
      currency: 'KES', // Use KES for Paystack
      ref: config.reference,
      callback_url: `${window.location.origin}/payment-success`,
      metadata: {
        project_id: String(treeData.id),
        trees_purchased: String(totalQuantity),
        donor_name: donorName,
        dedication_message: dedicationMessage,
        selected_species: JSON.stringify(selectedSpecies),
        custom_fields: config.metadata.custom_fields,
      },
      callback: function(response) {
        console.log('Payment successful:', response);
        onPaymentSuccess(response.reference);
      },
      onClose: function() {
        console.log('Payment closed by user');
        onClose();
      }
    });

    try {
      handler.openIframe();
    } catch (error) {
      console.error('Paystack setup error:', error);
      toast.error('Payment setup failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 text-[#067d83] hover:text-[#055a5f] font-medium flex items-center"
      >
        <FaArrowLeft className="mr-2" />
        Back to Tree Selection
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Tree Info Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
          <div className="flex items-center mb-4">
            <FaTree className="text-4xl mr-4" />
            <div>
              <h2 className="text-2xl font-bold">{treeData.name}</h2>
              <p className="text-green-100">{treeData.description}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <FaLeaf className="mr-2" />
              <span>{treeData.co2Absorption}kg CO₂/year</span>
            </div>
            <div className="flex items-center">
              <FaGlobe className="mr-2" />
              <span>{treeData.plantingLocation}</span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Complete Your Tree Planting
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dedication Message (Optional)
              </label>
              <textarea
                value={dedicationMessage}
                onChange={(e) => setDedicationMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Dedicate this tree to someone special or add a personal message"
                rows="3"
              />
            </div>

            {/* Tree Species Selection */}
            {availableSpecies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Tree Species & Quantities
                </label>
                <div className="space-y-3">
                  {availableSpecies.map((species, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{species}</h4>
                        <p className="text-sm text-gray-600">${treeData.price} per tree</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSpeciesQuantityChange(species, (selectedSpecies[species] || 0) - 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600"
                          disabled={!selectedSpecies[species] || selectedSpecies[species] <= 0}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={selectedSpecies[species] || 0}
                          onChange={(e) => handleSpeciesQuantityChange(species, e.target.value)}
                          className="w-16 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSpeciesQuantityChange(species, (selectedSpecies[species] || 0) + 1)}
                          className="w-8 h-8 rounded-full bg-green-200 hover:bg-green-300 flex items-center justify-center text-green-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Total Summary */}
                {totalQuantity > 0 && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-green-800">Total Trees Selected:</span>
                      <span className="font-bold text-green-800">{totalQuantity}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tree Benefits Reminder */}
            <div className="bg-green-50 p-4 rounded-md">
              <h4 className="font-semibold text-green-800 mb-2">Your Tree Will:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                {treeData.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center">
                    <FaLeaf className="mr-2 text-green-600" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Display */}
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-medium text-gray-700">Total Amount:</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    ${totalAmount.toLocaleString()}
                  </div>
                  {loadingExchangeRate ? (
                    <div className="text-sm text-gray-500">
                      Loading exchange rate...
                    </div>
                  ) : convertedAmount ? (
                    <div className="text-sm text-gray-600">
                      ≈ KSh{convertedAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </div>
                  ) : null}
                </div>
              </div>
              {exchangeRate && (
                <div className="text-xs text-gray-500 mb-2">
                  Exchange rate: 1 USD = {exchangeRate.toFixed(2)} KES
                </div>
              )}
              <p className="text-sm text-gray-600">
                Includes tree planting, maintenance, and certificate
                {totalQuantity > 1 && ` for ${totalQuantity} trees`}
              </p>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading || loadingExchangeRate || !convertedAmount || totalQuantity === 0}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {loading ? 'Processing...' : loadingExchangeRate ? 'Loading exchange rate...' : totalQuantity === 0 ? 'Select trees to plant' : `🌱 Plant ${totalQuantity} Tree${totalQuantity > 1 ? 's' : ''} for KSh${convertedAmount ? convertedAmount.toLocaleString(undefined, {maximumFractionDigits: 0}) : '...'} ($${totalAmount.toLocaleString()})`}
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Secure payment powered by Paystack • Your tree will be planted within 7 days
            </p>
          </div>
        </div>
      </div>
      
      {/* Payment Success Modal */}
      {showPaymentSuccess && paymentSuccessData && (
        <PaymentSuccess
          paymentData={paymentSuccessData}
          onClose={() => {
            setShowPaymentSuccess(false);
            setPaymentSuccessData(null);
            // Close the payment component after success modal is closed
            if (onBack) {
              onBack();
            }
          }}
        />
      )}

      {/* Certificate Modal */}
      <TreeCertificate
        isOpen={showCertificate}
        onClose={() => {
          console.log('Closing certificate modal');
          setShowCertificate(false);
        }}
        certificateData={certificateData}
        onDownload={async (certificateId) => {
          console.log('Downloading certificate:', certificateId);
          // Mark certificate as downloaded
          setDownloadedCertificates(prev => new Set([...prev, certificateId]));
          
          try {
            // Update database
            await client.run('post', endpoints.markCertificateDownloaded, {
              certificate_id: certificateId,
              user_id: getUser().id
            }, true);
          } catch (error) {
            console.error('Error marking certificate as downloaded:', error);
          }
        }}
        onShare={() => {
          toast.success('Achievement shared! 🌳');
        }}
        isDownloaded={certificateData ? downloadedCertificates.has(certificateData.certificate_id) : false}
      />
    </div>
  );
};

export default TreePayment;
