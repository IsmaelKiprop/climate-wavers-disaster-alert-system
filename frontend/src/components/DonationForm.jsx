import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { fetchUsdToKesRate } from '../utils/exchangeRate';
import { getUser } from '../utils/factory';

const DonationForm = ({ onClose }) => {
  const [donationType, setDonationType] = useState('monthly');
  const [selectedAmount, setSelectedAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('25');
  const [email, setEmail] = useState('');
  const [donorName, setDonorName] = useState('');
  const [comments, setComments] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(150);
  const [convertedAmount, setConvertedAmount] = useState(0);

  const predefinedAmounts = [25, 50, 100, 300, 500, 1000];

  // Load user data on component mount
  useEffect(() => {
    const user = getUser();
    if (user) {
      setEmail(user.email || '');
      setDonorName(user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '');
    }
  }, []);

  // Fetch exchange rate
  const fetchExchangeRate = async () => {
    const usdToKesRate = await fetchUsdToKesRate();
    setExchangeRate(usdToKesRate);
    return usdToKesRate;
  };

  // Load Paystack script
  useEffect(() => {
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

    // Fetch exchange rate
    fetchExchangeRate();

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Update converted amount when amount changes
  useEffect(() => {
    const amount = selectedAmount || parseFloat(customAmount) || 0;
    const converted = amount * exchangeRate;
    setConvertedAmount(converted);
  }, [selectedAmount, customAmount, exchangeRate]);

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value) => {
    setCustomAmount(value);
    setSelectedAmount('');
  };

  const handlePayment = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    if (!donorName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const amount = selectedAmount || parseFloat(customAmount) || 0;
    if (amount <= 0) {
      toast.error('Please select or enter a support amount');
      return;
    }

    if (!window.PaystackPop) {
      toast.error('Payment system not ready. Please refresh the page and try again.');
      return;
    }

    setLoading(true);

    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a';
    const reference = (new Date()).getTime().toString();
    
    console.log('Donation Payment Configuration:', {
      key: paystackKey,
      email: email,
      amount: Math.round(convertedAmount * 100), // KES amount in cents
      currency: 'KES',
      ref: reference,
      originalUSD: amount,
      convertedKES: convertedAmount
    });

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: email,
      amount: Math.round(convertedAmount * 100), // Convert KES to cents
      currency: 'KES',
      ref: reference,
      metadata: {
        custom_fields: [
          {
            display_name: "Donation Type",
            variable_name: "donation_type",
            value: donationType
          },
          {
            display_name: "Donor Name",
            variable_name: "donor_name",
            value: donorName
          },
          {
            display_name: "Comments",
            variable_name: "comments",
            value: comments
          }
        ]
      },
      callback: function(response) {
        console.log('Payment successful:', response);
        onPaymentSuccess(response.reference);
      },
      onClose: function() {
        console.log('Payment closed by user');
        setLoading(false);
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

  const onPaymentSuccess = async (reference) => {
    try {
      // Here you would typically send the payment data to your backend
      // For now, we'll just show a success message
      toast.success('Thank you for supporting Climate Wavers. You help keep WhatsApp + email alerts running.');
      
      // Reset form
      setSelectedAmount('');
      setCustomAmount('25');
      setComments('');
      setShowComments(false);
      
      // Close the modal after a short delay
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Error processing donation:', error);
      toast.error('There was an error processing your donation. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-surface max-w-md w-full max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Support Climate Wavers</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Donation Type */}
          <div className="mb-6">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setDonationType('one-time')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  donationType === 'one-time'
                    ? 'bg-[#067d83] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ONE TIME
              </button>
              <button
                onClick={() => setDonationType('monthly')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  donationType === 'monthly'
                    ? 'bg-[#067d83] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                MONTHLY
              </button>
            </div>
          </div>

          {/* Predefined Amounts */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              {predefinedAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleAmountSelect(amount)}
                  className={`py-3 px-4 border rounded-lg font-medium transition-colors ${
                    selectedAmount === amount
                      ? 'border-[#067d83] bg-[#067d83] text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="mb-6">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-3 py-3 flex items-center">
                <span className="text-gray-600">$</span>
              </div>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 py-3 px-3 border-0 focus:outline-none"
                min="1"
              />
            </div>
          </div>

          {/* Donor Information */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#067d83] focus:border-transparent"
                placeholder="Enter your full name"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#067d83] focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Comments */}
          <div className="mb-6">
            <button
              onClick={() => setShowComments(!showComments)}
              className="text-[#067d83] text-sm font-medium hover:underline"
            >
              Add Comments
            </button>
            {showComments && (
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add a personal message or dedication..."
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#067d83] focus:border-transparent"
                rows="3"
              />
            )}
          </div>

          {/* Amount Summary */}
          {convertedAmount > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Support amount:</span>
                <span className="font-semibold">${selectedAmount || customAmount} USD</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Equivalent in KES:</span>
                <span>KSh {convertedAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          <p className="mb-4 text-sm text-gray-600">
            Fuel WhatsApp + email disaster alerts. Prefer planting?{" "}
            <a href="/app/plant-tree" className="text-[#067d83] font-medium hover:underline">
              Plant a tree
            </a>
            {" · "}
            <a href="/pricing" className="text-[#067d83] font-medium hover:underline">
              See pricing
            </a>
          </p>

          {/* Support Button */}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full bg-[#067d83] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#055a5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'SUPPORT'}
          </button>

          {/* Security Note */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Secure payment powered by Paystack
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonationForm;



