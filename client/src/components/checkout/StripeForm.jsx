import { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Input from '../ui/Input';
import Button from '../ui/Button';
import DonationReceipt from '../donation/DonationReceipt';
import { useAuth } from '../../context/AuthContext';
import { createSubscription, createOneTimeDonation } from '../../services/api';
import COUNTRIES from '../../utils/countries';

/**
 * Map Stripe / backend error codes to user-friendly messages.
 */
const ERROR_MESSAGES = {
  card_declined:       'Your card was declined. Please try a different card.',
  insufficient_funds:  'Insufficient funds. Please try a different card.',
  expired_card:        'Your card has expired. Please use a different card.',
  incorrect_cvc:       'The CVC code is incorrect. Please check and try again.',
  processing_error:    'A processing error occurred. Please try again.',
  incorrect_number:    'The card number is incorrect.',
  duplicate_subscription: null, // Use backend message directly
  rate_limited:        'Too many attempts. Please wait a few minutes and try again.',
  validation_error:    null, // Use backend message directly
};

function getFriendlyError(errorCode, fallbackMessage) {
  if (errorCode && errorCode in ERROR_MESSAGES) {
    return ERROR_MESSAGES[errorCode] || fallbackMessage;
  }
  return fallbackMessage || 'Something went wrong. Please try again.';
}

export default function StripeForm({ amount, onClose, isRecurring = true, box = null, tiers = [] }) {
  const stripe = useStripe();
  const elements = useElements();

  let user = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    // Auth context not available
  }

  const [formData, setFormData] = useState({
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    country: user?.country || '',
  });

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        email: user.email || prev.email,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        country: user.country || prev.country,
      }));
    }
  }, [user]);

  const [errors, setErrors] = useState({});
  const [cardFocused, setCardFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [infoVerified, setInfoVerified] = useState(false);

  const getTierName = (amt) => {
    if (isRecurring && box && box.title) {
      return box.title;
    }
    if (isRecurring && Array.isArray(tiers) && tiers.length > 0) {
      const matchedTier = tiers.find(t => {
        const matchesMin = amt >= t.minAmount;
        const matchesMax = t.maxAmount === null || t.maxAmount === undefined || amt <= t.maxAmount;
        return matchesMin && matchesMax;
      });
      if (matchedTier) {
        return matchedTier.name;
      }
    }
    if (amt >= 170) return 'Patron';
    if (amt >= 85) return 'Shareholder';
    return 'Regular';
  };

  const getTierPerks = (amt) => {
    if (isRecurring && box && Array.isArray(box.perks) && box.perks.length > 0) {
      return box.perks;
    }
    if (isRecurring && Array.isArray(tiers) && tiers.length > 0) {
      const matchedTier = tiers.find(t => {
        const matchesMin = amt >= t.minAmount;
        const matchesMax = t.maxAmount === null || t.maxAmount === undefined || amt <= t.maxAmount;
        return matchesMin && matchesMax;
      });
      if (matchedTier) {
        try {
          return typeof matchedTier.perks === 'string'
            ? JSON.parse(matchedTier.perks)
            : (Array.isArray(matchedTier.perks) ? matchedTier.perks : []);
        } catch {
          return [];
        }
      }
    }
    if (amt >= 170) return ['All Shareholder perks', 'Sponsor name on camp t-shirts', 'Quarterly social thank-yous'];
    if (amt >= 85) return ['All Regular perks', 'Campaign creation voting', 'Quarterly meetings & extra votes'];
    return ['Monthly updates newsletter', 'Yearly zoom impact event', 'Discounted OMP group tours'];
  };

  // Mock card states and formatting handlers
  const [mockCard, setMockCard] = useState('0000 0000 0000 0000');
  const [mockExpiry, setMockExpiry] = useState('11/30');
  const [mockCvc, setMockCvc] = useState('000');

  const isCardValid = mockCard.replace(/\s/g, '').length === 16;
  const isExpiryValid = /^\d{2}\/\d{2}$/.test(mockExpiry);
  const isCvcValid = mockCvc.length === 3;

  const handleMockCardChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setMockCard(formatted);
  };

  const handleMockExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) {
      val = val.slice(0, 2) + '/' + val.slice(2);
    }
    setMockExpiry(val);
  };

  const handleMockCvcChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 3);
    setMockCvc(val);
  };

  const updateField = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setSubmitError('');
  };

  const validate = () => {
    const errs = {};
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Valid email is required';
    }
    if (!formData.firstName.trim()) errs.firstName = 'First name is required';
    if (!formData.lastName.trim()) errs.lastName = 'Last name is required';
    if (!formData.country) errs.country = 'Please select a country';

    if (isMockStripe) {
      const cleanCard = mockCard.replace(/\s/g, '');
      if (cleanCard.length !== 16) {
        errs.card = 'Card number must be 16 digits';
      }
      if (!/^\d{2}\/\d{2}$/.test(mockExpiry)) {
        errs.expiry = 'Expiration date must be MM/YY';
      }
      if (mockCvc.length !== 3) {
        errs.cvc = 'CVC must be 3 digits';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isMockStripe = !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_placeholder') ||
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY.includes('replace_with_your_key');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError('');

    const styleTrace = (text, isHeader = false) => {
      return isHeader
        ? [
            `%c${text}`,
            "color: #ffffff; background: #7c5cfc; font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 12px;"
          ]
        : [
            `%c${text}`,
            "color: #7c5cfc; font-weight: 500; font-size: 11px; padding-left: 10px;"
          ];
    };

    console.log(...styleTrace("┌── 💳 [FRONTEND] Checkout Form Submitted", true));
    console.log(...styleTrace(`├── Form Data: ${formData.firstName} ${formData.lastName} (${formData.email})`));
    console.log(...styleTrace(`├── Amount: $${amount}${isRecurring ? '/month' : ' (one-time)'}`));

    try {
      let paymentMethodId = 'pm_mock_123';

      if (!isMockStripe && stripe && elements) {
        console.log(...styleTrace("├── 📦 Requesting Stripe PaymentMethod tokenization..."));
        const cardElement = elements.getElement(CardElement);
        const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
          },
        });

        if (pmError) {
          console.log(...styleTrace(`├── ❌ Stripe tokenization failed: ${pmError.message}`));
          throw new Error(pmError.message);
        }

        paymentMethodId = paymentMethod.id;
        console.log(...styleTrace(`├── 📦 Stripe PaymentMethod created: ${paymentMethodId}`));
      } else {
        console.log(...styleTrace("├── 🛡️ (Mock) Bypassed real Stripe tokenization. Using: pm_mock_123"));
      }

      // ── Step 2: Send tokenised PM to backend ──
      const checkoutPayload = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        country: formData.country,
        paymentMethodId: paymentMethodId,
        amount: amount,
        donationBoxId: box ? box.id : undefined,
      };

      let result;
      if (isRecurring) {
        console.log(...styleTrace("├── 🌐 Dispatching POST /api/v1/donations/subscribe..."));
        result = await createSubscription(checkoutPayload);
      } else {
        console.log(...styleTrace("├── 🌐 Dispatching POST /api/v1/donations/one-time..."));
        result = await createOneTimeDonation(checkoutPayload);
      }
      console.log(...styleTrace(`├── 🌐 Backend responded successfully: status = ${result.status}`));

      // ── Step 3: Handle SCA / 3D Secure if required ──
      if (result.status === 'requires_action' && result.clientSecret) {
        if (!isMockStripe && stripe) {
          console.log(...styleTrace("├── 🔒 Confirming Card Payment (3D Secure Required)..."));
          const { error: confirmError } = await stripe.confirmCardPayment(
            result.clientSecret
          );

          if (confirmError) {
            console.log(...styleTrace(`├── ❌ 3D Secure confirmation failed: ${confirmError.message}`));
            throw new Error(confirmError.message);
          }
          console.log(...styleTrace("├── 🔒 3D Secure verification succeeded!"));
        } else {
          console.log(...styleTrace("├── 🛡️ (Mock) Bypassed 3D Secure confirmation. Succeeding automatically."));
        }
      }

      console.log(...styleTrace("└── 🎉 Checkout flow completed successfully!", true));
      setReferenceId('TXN_' + Math.floor(100000 + Math.random() * 900000));
      setSuccess(true);
    } catch (err) {
      console.log(`%c└── ❌ Error: ${err.message}`, "color: #ea4335; font-weight: bold;");
      const errorCode = err.errorCode || err.error || '';
      const errorMessage = getFriendlyError(errorCode, err.message);
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const tierName = getTierName(amount);
    const tierPerks = getTierPerks(amount);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <div className="checkout-form__success" style={{ padding: '8px 0' }}>
        {/* Dynamic CSS Confetti Particles */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 99 }}>
          {Array.from({ length: 40 }).map((_, idx) => {
            const left = (idx * 17) % 100;
            const width = 5 + ((idx * 3) % 8);
            const height = 8 + ((idx * 7) % 12);
            const colorIndex = (idx * 3) % 4;
            const rotation = (idx * 29) % 360;
            const duration = 1.5 + (((idx * 11) % 10) / 10) * 2;
            const delay = ((idx * 13) % 10) / 25;
            const colors = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
            return (
              <div
                key={idx}
                className="confetti-piece"
                style={{
                  position: 'absolute',
                  top: `-20px`,
                  left: `${left}%`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: colors[colorIndex],
                  opacity: 0.8,
                  transform: `rotate(${rotation}deg)`,
                  animation: `float-down ${duration}s ease-out forwards`,
                  animationDelay: `${delay}s`
                }}
              />
            );
          })}
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '4px' }}>Thank You! 🎉</h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
          {isRecurring ? (
            <>Your monthly donation of <strong>${amount}/mo</strong> has been set up successfully.</>
          ) : (
            <>Your one-time donation of <strong>${amount}</strong> has been processed successfully.</>
          )}
        </p>

        <DonationReceipt
          referenceId={referenceId}
          dateStr={dateStr}
          amount={amount}
          donorName={`${formData.firstName} ${formData.lastName}`}
          donorEmail={formData.email}
          country={formData.country}
          tierName={isRecurring ? tierName : 'One-Time Supporter'}
          tierPerks={isRecurring ? tierPerks : ['One-time support', 'Counted in milestones & total donation amount']}
          showPrintButton={true}
          onClose={onClose}
          isRecurring={isRecurring}
        />
      </div>
    );
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      {/* Personal Info */}
      <div>
        <p className="checkout-form__section-label">Personal Information</p>
        <div className="checkout-form__row">
          <Input
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={updateField('firstName')}
            placeholder="John"
            error={errors.firstName}
            required
            disabled={!!user}
          />
          <Input
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={updateField('lastName')}
            placeholder="Doe"
            error={errors.lastName}
            required
            disabled={!!user}
          />
        </div>
      </div>

      <Input
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={updateField('email')}
        placeholder="john@example.com"
        error={errors.email}
        required
        disabled={!!user}
      />


      <div className="input-group">
        <label className="input-group__label" htmlFor="country">
          Country <span className="input-group__required">*</span>
        </label>
        <select
          id="country"
          className="input-group__input"
          style={{ color: '#202124', backgroundColor: '#ffffff' }}
          value={formData.country}
          onChange={updateField('country')}
          required
        >
          <option value="">Select your country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.country && <span className="input-group__error">{errors.country}</span>}
      </div>

      {/* Card Details */}
      <div>
        <p className="checkout-form__section-label">Payment Details</p>
        {isMockStripe ? (
          <div className="checkout-form__mock-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Card Number"
                value={mockCard}
                onChange={handleMockCardChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: isCardValid
                    ? '1px solid #34a853'
                    : (errors.card ? '1px solid var(--color-error)' : '1px solid var(--color-border)'),
                  boxShadow: isCardValid ? '0 0 0 3px rgba(52, 168, 83, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: 'var(--color-text-primary)',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
            {errors.card && <span style={{ fontSize: '12px', color: 'var(--color-error)', display: 'block', margin: '-4px 0 4px 4px' }}>{errors.card}</span>}
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="MM/YY"
                value={mockExpiry}
                onChange={handleMockExpiryChange}
                style={{
                  width: '50%',
                  padding: '12px 16px',
                  border: isExpiryValid
                    ? '1px solid #34a853'
                    : (errors.expiry ? '1px solid var(--color-error)' : '1px solid var(--color-border)'),
                  boxShadow: isExpiryValid ? '0 0 0 3px rgba(52, 168, 83, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: 'var(--color-text-primary)',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <input
                type="text"
                placeholder="CVC"
                value={mockCvc}
                onChange={handleMockCvcChange}
                style={{
                  width: '50%',
                  padding: '12px 16px',
                  border: isCvcValid
                    ? '1px solid #34a853'
                    : (errors.cvc ? '1px solid var(--color-error)' : '1px solid var(--color-border)'),
                  boxShadow: isCvcValid ? '0 0 0 3px rgba(52, 168, 83, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: 'var(--color-text-primary)',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              {errors.expiry && <span style={{ fontSize: '12px', color: 'var(--color-error)', width: '50%', paddingLeft: '4px' }}>{errors.expiry}</span>}
              {errors.cvc && <span style={{ fontSize: '12px', color: 'var(--color-error)', width: '50%', paddingLeft: '4px' }}>{errors.cvc}</span>}
            </div>

            <span style={{ fontSize: '12px', color: 'var(--brand-blue)', fontStyle: 'italic', marginTop: '4px' }}>
              ✨ Stripe is in MOCK mode. You can use your custom card `0000 0000 0000 0000` to test!
            </span>
          </div>
        ) : (
          <div className={`checkout-form__card-element ${cardFocused ? 'checkout-form__card-element--focused' : ''}`}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#202124',
                    fontFamily: 'Inter, sans-serif',
                    '::placeholder': { color: 'rgba(32, 33, 36, 0.4)' },
                  },
                  invalid: { color: '#ea4335' },
                },
              }}
              onFocus={() => setCardFocused(true)}
              onBlur={() => setCardFocused(false)}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '16px 0 8px' }} className="print-hide">
        <input
          id="info-verify-checkbox"
          type="checkbox"
          checked={infoVerified}
          onChange={(e) => setInfoVerified(e.target.checked)}
          style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
          required
        />
        <label htmlFor="info-verify-checkbox" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          I confirm that my personal information is correct (Email: <strong>{formData.email}</strong>). It is critical that my email is accurate.
        </label>
      </div>

      {submitError && (
        <div className="checkout-form__error" role="alert" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {submitError}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        disabled={(!isMockStripe && (!stripe || !elements)) || loading || !infoVerified}
        className="print-hide"
      >
        Donate ${amount}{isRecurring ? '/month' : ''}
      </Button>

      <div className="checkout-form__secure">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe · 256-bit encryption
      </div>
    </form>
  );
}
