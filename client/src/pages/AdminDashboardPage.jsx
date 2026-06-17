import { Routes, Route } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import CMSProjects from '../components/admin/CMSProjects';
import CMSDonationBoxes from '../components/admin/CMSDonationBoxes';
import CMSTiers from '../components/admin/CMSTiers';
import CMSMilestones from '../components/admin/CMSMilestones';
import CMSTransactions from '../components/admin/CMSTransactions';
import CMSReceiptSettings from '../components/admin/CMSReceiptSettings';
import EditContentPage from './admin/EditContentPage';
import AdminSettingsPage from './admin/AdminSettingsPage';
import './AdminDashboardPage.css';

/**
 * AdminDashboardPage — Master layout for administrative dashboard.
 * Separates sections utilizing React Router nesting for seamless page state retention.
 *
 * @returns {JSX.Element}
 */
export default function AdminDashboardPage() {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <Routes>
          <Route path="/" element={<EditContentPage />} />
          <Route path="/projects" element={<CMSProjects />} />
          <Route path="/donation-boxes" element={<CMSDonationBoxes />} />
          <Route path="/tiers" element={<CMSTiers />} />
          <Route path="/milestones" element={<CMSMilestones />} />
          <Route path="/transactions" element={<CMSTransactions />} />
          <Route path="/receipts" element={<CMSReceiptSettings />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
