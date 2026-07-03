import { Routes, Route } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import CMSProjects from '../components/admin/CMSProjects';
import CMSDonationBoxes from '../components/admin/CMSDonationBoxes';
import CMSTiers from '../components/admin/CMSTiers';
import CMSMilestones from '../components/admin/CMSMilestones';
import CMSTransactions from '../components/admin/CMSTransactions';
import CMSReceiptSettings from '../components/admin/CMSReceiptSettings';
import CMSUsers from '../components/admin/CMSUsers';
import CommunicationHub from '../components/admin/CommunicationHub';
import EditContentPage from './admin/EditContentPage';
import AdminSettingsPage from './admin/AdminSettingsPage';
import AdminRoleGuard from '../components/router/AdminRoleGuard';
import { PERMISSIONS } from '../config/permissions';
import './AdminDashboardPage.css';

/**
 * AdminDashboardPage — Master layout for administrative dashboard.
 * Separates sections utilizing React Router nesting for seamless page state retention.
 * Enforces declarative authorization checks on sub-routes.
 *
 * @returns {JSX.Element}
 */
export default function AdminDashboardPage() {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <Routes>
          <Route path="/" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_EDIT_CONTENT}>
              <EditContentPage />
            </AdminRoleGuard>
          } />
          <Route path="/projects" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_PROJECTS}>
              <CMSProjects />
            </AdminRoleGuard>
          } />
          <Route path="/donation-boxes" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_DONATIONS}>
              <CMSDonationBoxes />
            </AdminRoleGuard>
          } />
          <Route path="/tiers" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_DONATIONS}>
              <CMSTiers />
            </AdminRoleGuard>
          } />
          <Route path="/milestones" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_DONATIONS}>
              <CMSMilestones />
            </AdminRoleGuard>
          } />
          <Route path="/transactions" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_VIEW_TRANSACTIONS}>
              <CMSTransactions />
            </AdminRoleGuard>
          } />
          <Route path="/receipts" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_RECEIPTS}>
              <CMSReceiptSettings />
            </AdminRoleGuard>
          } />
          <Route path="/communications" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_COMMUNICATIONS}>
              <CommunicationHub />
            </AdminRoleGuard>
          } />
          <Route path="/settings" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_SETTINGS}>
              <AdminSettingsPage />
            </AdminRoleGuard>
          } />
          <Route path="/users" element={
            <AdminRoleGuard requiredPermission={PERMISSIONS.CAN_MANAGE_USERS}>
              <CMSUsers />
            </AdminRoleGuard>
          } />
        </Routes>
      </main>
    </div>
  );
}
