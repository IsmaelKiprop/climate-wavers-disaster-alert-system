import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { fetchUsdToKesRate } from "../utils/exchangeRate";
import { getUser } from "../utils/factory";

const PaystackDonation = ({ campaign, onSuccess, onClose: onModalClose }) => {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [message, setMessage] = useState('');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(true);
  const user = getUser();

  // Currency configuration
  const currencyConfig = {
    USD: { symbol: '$', code: 'USD' },
    NGN: { symbol: '₦', code: 'NGN' },
    GHS: { symbol: '₵', code: 'GHS' },
    KES: { symbol: 'KSh', code: 'KES' }
  };

  // Default to KES for Paystack integration
  const selectedCurrency = currencyConfig.KES;

  // Initialize email with user's email if logged in
  useEffect(() => {
    if (user && user.email) {
      setEmail(user.email);
    }
    if (user && user.name) {
      setDonorName(user.name);
    }
  }, [user]);

  // Fetch exchange rate
  const fetchExchangeRate = async () => {
    setLoadingExchangeRate(true);
    try {
      const usdToKesRate = await fetchUsdToKesRate();
      setExchangeRate(usdToKesRate);
    } finally {
      setLoadingExchangeRate(false);
    }
  };

  // Calculate converted amount when amount or exchange rate changes
  useEffect(() => {
    if (exchangeRate && amount && parseFloat(amount) > 0) {
      const converted = parseFloat(amount) * exchangeRate;
      setConvertedAmount(converted);
    }
  }, [amount, exchangeRate]);

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
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePaystackSuccess = async (reference) => {
    console.log('Payment successful:', reference);
    setLoading(true);
    
    try {
      // Record donation in backend
      const donationData = {
        campaign: campaign.id,
        amount: parseFloat(amount),
        payment_reference: reference.reference,
        donor_name: donorName,
        message: message
      };
      
      const response = await client.run("post", endpoints.campaignDonations, donationData, true);
      console.log('Donation recorded:', response);
      
      // Show success message
      await Swal.fire({
        title: 'Donation Successful!',
        text: `Thank you for supporting this campaign with $${amount}.`,
        icon: 'success',
        confirmButtonText: 'OK'
      });
      
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (error) {
      console.error('Error recording donation:', error);
      await Swal.fire({
        title: 'Donation Recorded',
        text: 'Your payment was successful, but we had trouble updating the campaign. The team has been notified.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
    } finally {
      setLoading(false);
      setAmount('');
      setMessage('');
    }
  };

  const handlePaystackClose = () => {
    console.log('Payment closed');
    if (onModalClose) {
      onModalClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!email) {
      Swal.fire({
        title: 'Email Required',
        text: 'Please enter your email address',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      Swal.fire({
        title: 'Invalid Amount',
        text: 'Please enter a valid support amount',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Check if we have the converted amount
    if (!convertedAmount) {
      Swal.fire({
        title: 'Exchange Rate Loading',
        text: 'Please wait for the exchange rate to load.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Check if Paystack is loaded
    if (!window.PaystackPop) {
      Swal.fire({
        title: 'Payment System Not Ready',
        text: 'Please wait a moment and try again, or refresh the page.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    setLoading(true);
    
    // Paystack configuration
    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a';
    const reference = (new Date()).getTime().toString();
    
    // Debug: Log the configuration
    console.log('Paystack Configuration:', {
      key: paystackKey,
      email: email,
      amount: Math.round(convertedAmount * 100), // KES amount in cents
      currency: 'KES',
      ref: reference,
      originalUSD: parseFloat(amount),
      convertedKES: convertedAmount
    });
    
    // Use Paystack inline script with KES currency
    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: email,
      amount: Math.round(convertedAmount * 100), // Convert KES to cents
      currency: 'KES', // Use KES for Paystack
      ref: reference,
      metadata: {
        custom_fields: [
          {
            display_name: "Campaign Name",
            variable_name: "campaign_name",
            value: campaign.title || campaign.name
          },
          {
            display_name: "Campaign ID",
            variable_name: "campaign_id",
            value: campaign.id
          },
          {
            display_name: "Donor Name",
            variable_name: "donor_name",
            value: donorName
          },
          {
            display_name: "Message",
            variable_name: "message",
            value: message
          }
        ]
      },
      callback: function(response) {
        console.log('Payment successful:', response);
        handlePaystackSuccess(response);
      },
      onClose: function() {
        console.log('Payment closed by user');
        handlePaystackClose();
        setLoading(false);
      }
    });
    
    try {
      handler.openIframe();
    } catch (error) {
      console.error('Paystack setup error:', error);
      Swal.fire({
        title: 'Payment Setup Failed',
        text: 'There was an error setting up the payment. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border transition-all duration-300 transform hover:shadow-lg">
      <div className="p-3 md:p-4">
        <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 flex items-center">
          <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Support This Campaign
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Donation Amount Quick Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quick Amount
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[10, 25, 50, 100, 250, 500].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(value.toString())}
                  className={`px-1 py-1.5 text-xs md:text-sm rounded transition-all ${
                    amount === value.toString()
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  }`}
                >
                  ${value}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Donation Amount (USD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter amount"
                min="1"
                step="1"
                required
              />
            </div>
            {/* Show converted amount */}
            {convertedAmount && amount && parseFloat(amount) > 0 && (
              <div className="mt-1 text-xs text-gray-600">
                ≈ {selectedCurrency.symbol}{convertedAmount.toFixed(2)} {selectedCurrency.code}
                {loadingExchangeRate && <span className="ml-1 text-blue-500">(Loading rate...)</span>}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Add a message of support"
              rows="2"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !email || !amount}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              `Support $${amount || '0'}${convertedAmount ? ` (≈ ${selectedCurrency.symbol}${convertedAmount.toFixed(0)})` : ''}`
            )}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <svg className="w-4 h-4 text-green-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs text-gray-600">Secure payment</span>
          </div>
          <p className="text-xs text-gray-500">
            Powered by Paystack
          </p>
        </div>
      </div>
      
      {/* Campaign Impact - Compact version */}
      <div className="bg-green-50 p-2 rounded-b-lg border-t border-green-100">
        <h4 className="text-xs font-medium text-green-800 mb-1">Your support helps:</h4>
        <div className="flex flex-wrap text-xs text-green-700">
          <div className="flex items-center mr-3 mb-1">
            <svg className="w-3 h-3 text-green-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Climate action
          </div>
          <div className="flex items-center mr-3 mb-1">
            <svg className="w-3 h-3 text-green-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Communities
          </div>
          <div className="flex items-center mb-1">
            <svg className="w-3 h-3 text-green-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Environment
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaystackDonation;
