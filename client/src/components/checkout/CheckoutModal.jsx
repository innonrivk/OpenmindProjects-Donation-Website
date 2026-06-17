import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import Modal from '../ui/Modal';
import StripeForm from './StripeForm';
import './CheckoutModal.css';

// Initialize Stripe — use env variable or placeholder
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'
);

const stripeElementsOptions = {
  appearance: {
    theme: 'stripe',
    variables: {
      colorPrimary: '#4285f4',
      colorBackground: '#ffffff',
      colorText: '#202124',
      colorTextSecondary: '#5f6368',
      colorTextPlaceholder: '#80868b',
      colorDanger: '#ea4335',
      fontFamily: 'Inter, sans-serif',
      borderRadius: '8px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        backgroundColor: '#ffffff',
        border: '1px solid #dadce0',
        padding: '12px 16px',
        boxShadow: 'none',
      },
      '.Input:focus': {
        borderColor: '#4285f4',
        boxShadow: '0 0 0 1px #4285f4',
      },
      '.Label': {
        fontSize: '14px',
        fontWeight: '500',
        color: '#202124',
      },
    },
  },
};

export default function CheckoutModal({ isOpen, onClose, amount, isRecurring = true, box = null, tiers = [] }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Your Donation" size="lg">
      <div className="checkout">
        <div className="checkout__amount-banner">
          <span className="checkout__amount-label">{isRecurring ? 'Monthly Donation' : 'One-time Donation'}</span>
          <span className="checkout__amount-value">
            <span className="checkout__currency">$</span>
            {amount}
            {isRecurring && <span className="checkout__period">/mo</span>}
          </span>
        </div>

        <Elements stripe={stripePromise} options={stripeElementsOptions}>
          <StripeForm amount={amount} onClose={onClose} isRecurring={isRecurring} box={box} tiers={tiers} />
        </Elements>
      </div>
    </Modal>
  );
}
