import { useState } from 'react';
import Header from '../components/layout/Header';
import HeroSection from '../components/layout/HeroSection';
import Footer from '../components/layout/Footer';
import ProjectsSection from '../components/donation/ProjectsSection';
import DonationGrid from '../components/donation/DonationGrid';
import DonationProgramDetails from '../components/donation/DonationProgramDetails';
import CheckoutModal from '../components/checkout/CheckoutModal';
import { useCMS } from '../hooks/useCMS';
import { useContent } from '../context/ContentContext';
import { CONTENT_KEYS } from '../lib/contentKeys';
import { formatContent } from '../utils/formatContent';
import './DonationPage.css';

/**
 * DonationPage renders the primary landing and donation portal.
 * Houses Hero, Projects Carousel, Donation options, Mission section, and Program metrics/details.
 * 
 * @returns {JSX.Element}
 */
export default function DonationPage() {
  const { data: content, isLoading: loading } = useCMS();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [isRecurring, setIsRecurring] = useState(true);
  const [selectedBox, setSelectedBox] = useState(null);

  const welcomeHeroIntro = useContent(
    CONTENT_KEYS.WELCOME_HERO_INTRO,
    'By becoming a monthly donor, you join a movement of changemakers who believe in consistent, long-term impact. Your contribution — no matter the size — helps us plan ahead, scale our projects, and deliver measurable results to the communities we serve.\n\n10% of all donations go into our community "Piggy Banks," where you and fellow donors vote on which projects receive additional funding boosts. Together, we decide where your impact grows.'
  );

  /**
   * Triggers the Checkout/Subscription modal.
   * @param {number} amount - Amount in USD.
   * @param {boolean} recurring - Whether the donation is monthly/recurring.
   * @param {Object|null} box - Selected donation box configuration.
   */
  const handleDonate = (amount, recurring = true, box = null) => {
    setSelectedAmount(amount);
    setIsRecurring(recurring);
    setSelectedBox(box);
    setCheckoutOpen(true);
  };

  /**
   * Resets Checkout/Subscription modal states.
   */
  const handleCloseCheckout = () => {
    setCheckoutOpen(false);
    setSelectedAmount(null);
    setSelectedBox(null);
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="page-loader__spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="donation-page">
      <Header />
      <HeroSection />

      {/* Project descriptions — between hero and donation grid */}
      <ProjectsSection projects={content?.projects || []} />

      {/* Grid of preset monthly amounts */}
      <DonationGrid
        boxes={content?.donationBoxes || []}
        onDonate={handleDonate}
      />

      {/* Mission / About section — placed between Grid and Tiers */}
      <section className="mission-section section">
        <div className="container">
          <div className="mission-content">
            <h2 className="mission-content__title">
              Our <span className="gradient-text">Mission</span>
            </h2>
            <div className="mission-content__body">
              {formatContent(welcomeHeroIntro)}
            </div>
          </div>
        </div>
      </section>

      {/* Donation tiers & milestones */}
      <DonationProgramDetails
        tiers={content?.tiers || []}
        milestones={content?.milestones || []}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={handleCloseCheckout}
        amount={selectedAmount}
        isRecurring={isRecurring}
        box={selectedBox}
        tiers={content?.tiers || []}
      />

      <Footer />
    </div>
  );
}
