import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper';
import { GlitchLoader } from './components/ui/GlitchLoader';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { CanvasHeaderProvider } from './components/canvas/CanvasHeaderContext';

// Lazy load all pages for code-splitting with automatic retry
const MockupMachinePage = lazyWithRetry(() => import('./pages/MockupMachinePage').then(m => ({ default: m.MockupMachinePage })));
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ThankYouPage = lazyWithRetry(() => import('./pages/ThankYouPage').then(m => ({ default: m.ThankYouPage })));
const CreditRechargeSuccessPage = lazyWithRetry(() => import('./components/CreditRechargeSuccessPage').then(m => ({ default: m.CreditRechargeSuccessPage })));
const MockupsPage = lazyWithRetry(() => import('./pages/MockupsPage').then(m => ({ default: m.MockupsPage })));
const MyOutputsPage = lazyWithRetry(() => import('./pages/MyOutputsPage').then(m => ({ default: m.MyOutputsPage })));
const CanvasPage = lazyWithRetry(() => import('./pages/CanvasPage').then(m => ({ default: m.CanvasPage })));
const CanvasProjectsPage = lazyWithRetry(() => import('./pages/CanvasProjectsPage').then(m => ({ default: m.CanvasProjectsPage })));
const CanvasSharedPage = lazyWithRetry(() => import('./pages/CanvasSharedPage').then(m => ({ default: m.CanvasSharedPage })));
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const AdminPresetsPage = lazyWithRetry(() => import('./pages/AdminPresetsPage').then(m => ({ default: m.AdminPresetsPage })));
const CommunityPage = lazyWithRetry(() => import('./pages/CommunityPage').then(m => ({ default: m.CommunityPage })));
const CommunityPresetsPage = lazyWithRetry(() => import('./pages/CommunityPresetsPage').then(m => ({ default: m.CommunityPresetsPage })));
const CommunityProfilePage = lazyWithRetry(() => import('./pages/CommunityProfilePage').then(m => ({ default: m.CommunityProfilePage })));
const BrandingMachinePage = lazyWithRetry(() => import('./pages/BrandingMachinePage').then(m => ({ default: m.BrandingMachinePage })));
const MyBrandingsPage = lazyWithRetry(() => import('./pages/MyBrandingsPage').then(m => ({ default: m.MyBrandingsPage })));
const BudgetMachinePage = lazyWithRetry(() => import('./pages/BudgetMachinePage').then(m => ({ default: m.BudgetMachinePage })));
const MyBudgetsPage = lazyWithRetry(() => import('./pages/MyBudgetsPage').then(m => ({ default: m.MyBudgetsPage })));
const BudgetSharedPage = lazyWithRetry(() => import('./pages/BudgetSharedPage').then(m => ({ default: m.BudgetSharedPage })));
const AppsPage = lazyWithRetry(() => import('./pages/AppsPage').then(m => ({ default: m.AppsPage })));
const QRCodePage = lazyWithRetry(() => import('./pages/QRCodePage').then(m => ({ default: m.QRCodePage })));
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const PrivacyPolicyPage = lazyWithRetry(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const WaitlistPage = lazyWithRetry(() => import('./pages/WaitlistPage').then(m => ({ default: m.WaitlistPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const DesignSystemPage = lazyWithRetry(() => import('./pages/DesignSystemPage').then(m => ({ default: m.DesignSystemPage })));
const EditorApp = lazyWithRetry(() => import('./EditorApp'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <GlitchLoader />
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundaryWrapper>
      <Layout>
        <ErrorBoundaryWrapper>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<MockupMachinePage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/thank-you" element={<ThankYouPage />} />
              <Route path="/recharge-success" element={<CreditRechargeSuccessPage />} />
              <Route path="/mockups" element={<MockupsPage />} />
              <Route path="/my-outputs" element={<MyOutputsPage />} />
              <Route path="/canvas" element={<CanvasProjectsPage />} />
              <Route path="/canvas/shared/:shareId" element={<CanvasSharedPage />} />
              <Route path="/canvas/:id" element={
                <CanvasHeaderProvider>
                  <CanvasPage />
                </CanvasHeaderProvider>
              } />
              <Route path="/branding-machine" element={<BrandingMachinePage />} />
              <Route path="/my-brandings" element={<MyBrandingsPage />} />
              <Route path="/budget-machine" element={<BudgetMachinePage />} />
              <Route path="/my-budgets" element={<MyBudgetsPage />} />
              <Route path="/budget/shared/:shareId" element={<BudgetSharedPage />} />
              <Route path="/apps" element={<AppsPage />} />
              <Route path="/qrcode" element={<QRCodePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="/auth" element={<AuthCallbackPage />} />
              <Route path="/waitlist" element={<WaitlistPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/editor" element={<EditorApp />} />
              <Route path="/editor/*" element={<EditorApp />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/presets" element={<AdminPresetsPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/community/presets" element={<CommunityPresetsPage />} />
              <Route path="/profile/:identifier" element={<CommunityProfilePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundaryWrapper>
      </Layout>
    </ErrorBoundaryWrapper>
  );
};

export default App;
