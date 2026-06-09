import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper';
import { GlitchLoader } from './components/ui/GlitchLoader';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { CanvasHeaderProvider } from './components/canvas/CanvasHeaderContext';
import { ActiveBrandKitProvider } from './contexts/BrandKitContext';
import { DesktopOnlyGate } from './components/shared/DesktopOnlyGate';
import { PremiumGate } from './components/shared/PremiumGate';

// Lazy load all pages for code-splitting with automatic retry
const HomePage = lazyWithRetry(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage }))
);
const MockupMachinePage = lazyWithRetry(() =>
  import('./pages/MockupMachinePage').then((m) => ({ default: m.MockupMachinePage }))
);
const PricingPage = lazyWithRetry(() =>
  import('./pages/PricingPage').then((m) => ({ default: m.PricingPage }))
);
const ProfilePage = lazyWithRetry(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const ThankYouPage = lazyWithRetry(() =>
  import('./pages/ThankYouPage').then((m) => ({ default: m.ThankYouPage }))
);
const ThankYouProPage = lazyWithRetry(() =>
  import('./pages/ThankYouProPage').then((m) => ({ default: m.ThankYouProPage }))
);
const ThankYouProAnualPage = lazyWithRetry(() =>
  import('./pages/ThankYouProAnualPage').then((m) => ({ default: m.ThankYouProAnualPage }))
);
const ThankYouVisionPage = lazyWithRetry(() =>
  import('./pages/ThankYouVisionPage').then((m) => ({ default: m.ThankYouVisionPage }))
);
const ThankYouVisionAnualPage = lazyWithRetry(() =>
  import('./pages/ThankYouVisionAnualPage').then((m) => ({ default: m.ThankYouVisionAnualPage }))
);
const CreditRechargeSuccessPage = lazyWithRetry(() =>
  import('./components/CreditRechargeSuccessPage').then((m) => ({
    default: m.CreditRechargeSuccessPage,
  }))
);
const MockupsPage = lazyWithRetry(() =>
  import('./pages/MockupsPage').then((m) => ({ default: m.MockupsPage }))
);
const MyOutputsPage = lazyWithRetry(() =>
  import('./pages/MyOutputsPage').then((m) => ({ default: m.MyOutputsPage }))
);
const CanvasPage = lazyWithRetry(() =>
  import('./pages/CanvasPage').then((m) => ({ default: m.CanvasPage }))
);
const CanvasProjectsPage = lazyWithRetry(() =>
  import('./pages/CanvasProjectsPage').then((m) => ({ default: m.CanvasProjectsPage }))
);
const CreativeProjectsPage = lazyWithRetry(() =>
  import('./pages/CreativeProjectsPage').then((m) => ({ default: m.CreativeProjectsPage }))
);
const CanvasSharedPage = lazyWithRetry(() =>
  import('./pages/CanvasSharedPage').then((m) => ({ default: m.CanvasSharedPage }))
);
const AdminPage = lazyWithRetry(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))
);
const AdminPresetsPage = lazyWithRetry(() =>
  import('./pages/AdminPresetsPage').then((m) => ({ default: m.AdminPresetsPage }))
);
const AdminProductsPage = lazyWithRetry(() =>
  import('./pages/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage }))
);
const SmartAnalyzerPage = lazyWithRetry(() =>
  import('./pages/SmartAnalyzerPage').then((m) => ({ default: m.SmartAnalyzerPage }))
);
const CommunityPage = lazyWithRetry(() =>
  import('./pages/CommunityPage').then((m) => ({ default: m.CommunityPage }))
);
const CommunityPresetsPage = lazyWithRetry(() =>
  import('./pages/CommunityPresetsPage').then((m) => ({ default: m.CommunityPresetsPage }))
);
const CommunityProfilePage = lazyWithRetry(() =>
  import('./pages/CommunityProfilePage').then((m) => ({ default: m.CommunityProfilePage }))
);
const BrandingMachinePage = lazyWithRetry(() =>
  import('./pages/BrandingMachinePage').then((m) => ({ default: m.BrandingMachinePage }))
);
const MyBrandingsPage = lazyWithRetry(() =>
  import('./pages/MyBrandingsPage').then((m) => ({ default: m.MyBrandingsPage }))
);
const BudgetMachinePage = lazyWithRetry(() =>
  import('./pages/BudgetMachinePage').then((m) => ({ default: m.BudgetMachinePage }))
);
const MyBudgetsPage = lazyWithRetry(() =>
  import('./pages/MyBudgetsPage').then((m) => ({ default: m.MyBudgetsPage }))
);
const BudgetSharedPage = lazyWithRetry(() =>
  import('./pages/BudgetSharedPage').then((m) => ({ default: m.BudgetSharedPage }))
);
const AppsPage = lazyWithRetry(() =>
  import('./pages/AppsPage').then((m) => ({ default: m.AppsPage }))
);
const ExtractorPage = lazyWithRetry(() => import('./pages/ExtractorPage'));
const QRCodePage = lazyWithRetry(() =>
  import('./pages/QRCodePage').then((m) => ({ default: m.QRCodePage }))
);
const AboutPage = lazyWithRetry(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const PrivacyPolicyPage = lazyWithRetry(() =>
  import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const ConnectPage = lazyWithRetry(() => import('./pages/ConnectPage'));
const AuthCallbackPage = lazyWithRetry(() =>
  import('./pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage }))
);
const NotFoundPage = lazyWithRetry(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const WaitlistPage = lazyWithRetry(() =>
  import('./pages/WaitlistPage').then((m) => ({ default: m.WaitlistPage }))
);
const ForgotPasswordPage = lazyWithRetry(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const DesignSystemPage = lazyWithRetry(() =>
  import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage }))
);
const DocsPage = lazyWithRetry(() =>
  import('./pages/DocsPage').then((m) => ({ default: m.DocsPage }))
);
const ApiKeysPage = lazyWithRetry(() =>
  import('./pages/ApiKeysPage').then((m) => ({ default: m.ApiKeysPage }))
);
const ConnectedAppsPage = lazyWithRetry(() =>
  import('./pages/ConnectedAppsPage').then((m) => ({ default: m.ConnectedAppsPage }))
);
const UsageDashboardPage = lazyWithRetry(() =>
  import('./pages/UsageDashboardPage').then((m) => ({ default: m.UsageDashboardPage }))
);
const GettingStartedPage = lazyWithRetry(() =>
  import('./pages/GettingStartedPage').then((m) => ({ default: m.GettingStartedPage }))
);
const BrandGuidelinesPage = lazyWithRetry(() =>
  import('./pages/BrandGuidelinesPage').then((m) => ({ default: m.BrandGuidelinesPage }))
);
const PublicBrandGuideline = lazyWithRetry(() =>
  import('./pages/PublicBrandGuideline').then((m) => ({ default: m.PublicBrandGuideline }))
);
const BrandingExpertPage = lazyWithRetry(() =>
  import('./pages/BrandingExpertPage').then((m) => ({ default: m.BrandingExpertPage }))
);
const CreatePage = lazyWithRetry(() =>
  import('./pages/CreatePage').then((m) => ({ default: m.CreatePage }))
);
const ContentStudioPage = lazyWithRetry(() =>
  import('./pages/ContentStudioPage').then((m) => ({ default: m.ContentStudioPage }))
);
const AdminChatPage = lazyWithRetry(() =>
  import('./pages/AdminChatPage').then((m) => ({ default: m.AdminChatPage }))
);
const OnboardPage = lazyWithRetry(() =>
  import('./pages/OnboardPage').then((m) => ({ default: m.OnboardPage }))
);
const MoodboardStudioPage = lazyWithRetry(() =>
  import('./pages/MoodboardStudioPage').then((m) => ({ default: m.MoodboardStudioPage }))
);
const GridPaintPage = lazyWithRetry(() =>
  import('./pages/GridPaintPage').then((m) => ({ default: m.GridPaintPage }))
);
const LabsPage = lazyWithRetry(() =>
  import('./pages/labs/LabsPage').then((m) => ({ default: m.LabsPage }))
);
const WindTunnelPage = lazyWithRetry(() =>
  import('./pages/labs/WindTunnelPage').then((m) => ({ default: m.WindTunnelPage }))
);
const BenchmarkArenaPage = lazyWithRetry(() => import('./pages/BenchmarkArenaPage'));
const Studio3DPage = lazyWithRetry(() =>
  import('./pages/Studio3DPage').then((m) => ({ default: m.Studio3DPage }))
);
const GridMachinePage = lazyWithRetry(() =>
  import('./pages/GridMachinePage').then((m) => ({ default: m.GridMachinePage }))
);
const ImageLabPage = lazyWithRetry(() =>
  import('./pages/ImageLabPage').then((m) => ({ default: m.ImageLabPage }))
);
const PlaygroundPage = lazyWithRetry(() =>
  import('./pages/PlaygroundPage').then((m) => ({ default: m.PlaygroundPage }))
);
const PlaygroundGalleryPage = lazyWithRetry(() =>
  import('./pages/PlaygroundGalleryPage').then((m) => ({ default: m.PlaygroundGalleryPage }))
);
const PlaygroundSharedPage = lazyWithRetry(() =>
  import('./pages/PlaygroundSharedPage').then((m) => ({ default: m.PlaygroundSharedPage }))
);
const DeveloperPortalPage = lazyWithRetry(() =>
  import('./pages/DeveloperPortalPage').then((m) => ({ default: m.DeveloperPortalPage }))
);
const VerifyEmailPage = lazyWithRetry(() =>
  import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage }))
);
const OnboardingWizardPage = lazyWithRetry(() =>
  import('./pages/OnboardingWizardPage').then((m) => ({ default: m.OnboardingWizardPage }))
);
const VisualSearchPage = lazyWithRetry(() =>
  import('./pages/VisualSearchPage').then((m) => ({ default: m.VisualSearchPage }))
);
const UpscalePage = lazyWithRetry(() =>
  import('./pages/UpscalePage').then((m) => ({ default: m.UpscalePage }))
);
const FaviconPage = lazyWithRetry(() =>
  import('./pages/FaviconPage').then((m) => ({ default: m.FaviconPage }))
);
const ColorConverterPage = lazyWithRetry(() =>
  import('./pages/ColorConverterPage').then((m) => ({ default: m.ColorConverterPage }))
);
const CompressPage = lazyWithRetry(() =>
  import('./pages/CompressPage').then((m) => ({ default: m.CompressPage }))
);
const PdfCompressPage = lazyWithRetry(() =>
  import('./pages/PdfCompressPage').then((m) => ({ default: m.PdfCompressPage }))
);
const ColorPalettePage = lazyWithRetry(() =>
  import('./pages/ColorPalettePage').then((m) => ({ default: m.ColorPalettePage }))
);
const ConverterPage = lazyWithRetry(() =>
  import('./pages/ConverterPage').then((m) => ({ default: m.ConverterPage }))
);
const SvgOptimizerPage = lazyWithRetry(() =>
  import('./pages/SvgOptimizerPage').then((m) => ({ default: m.SvgOptimizerPage }))
);
const WatermarkPage = lazyWithRetry(() =>
  import('./pages/WatermarkPage').then((m) => ({ default: m.WatermarkPage }))
);
const BgRemovePage = lazyWithRetry(() =>
  import('./pages/BgRemovePage').then((m) => ({ default: m.BgRemovePage }))
);
const OgImagePage = lazyWithRetry(() =>
  import('./pages/OgImagePage').then((m) => ({ default: m.OgImagePage }))
);

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <GlitchLoader />
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundaryWrapper>
      <CanvasHeaderProvider>
        <ActiveBrandKitProvider>
          <Layout>
            <ErrorBoundaryWrapper>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/mockupmachine" element={<MockupMachinePage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/thank-you" element={<ThankYouPage />} />
                  <Route path="/thank-you-pro" element={<ThankYouProPage />} />
                  <Route path="/thank-you-pro-anual" element={<ThankYouProAnualPage />} />
                  <Route path="/thank-you-vision" element={<ThankYouVisionPage />} />
                  <Route path="/thank-you-vision-anual" element={<ThankYouVisionAnualPage />} />
                  <Route path="/recharge-success" element={<CreditRechargeSuccessPage />} />
                  <Route path="/mockups" element={<MockupsPage />} />
                  <Route path="/my-outputs" element={<MyOutputsPage />} />
                  <Route path="/canvas" element={<CanvasProjectsPage />} />
                  <Route path="/canvas/shared/:shareId" element={<CanvasSharedPage />} />
                  <Route
                    path="/canvas/:id"
                    element={
                      <DesktopOnlyGate toolName="Canvas">
                        <CanvasPage />
                      </DesktopOnlyGate>
                    }
                  />
                  <Route path="/branding-machine" element={<BrandingMachinePage />} />
                  <Route
                    path="/my-brandings"
                    element={
                      <PremiumGate toolName="My Brandings">
                        <MyBrandingsPage />
                      </PremiumGate>
                    }
                  />
                  <Route path="/branding-expert" element={<BrandingExpertPage />} />
                  <Route path="/budget-machine" element={<BudgetMachinePage />} />
                  <Route path="/my-budgets" element={<MyBudgetsPage />} />
                  <Route path="/budget/shared/:shareId" element={<BudgetSharedPage />} />
                  <Route path="/apps" element={<AppsPage />} />
                  <Route path="/extractor" element={<ExtractorPage />} />
                  <Route
                    path="/moodboard"
                    element={
                      <DesktopOnlyGate toolName="Moodboard Studio">
                        <MoodboardStudioPage />
                      </DesktopOnlyGate>
                    }
                  />
                  <Route path="/visual-search" element={<VisualSearchPage />} />
                  <Route path="/upscale" element={<UpscalePage />} />
                  <Route path="/favicon" element={<FaviconPage />} />
                  <Route path="/color-converter" element={<ColorConverterPage />} />
                  <Route path="/compress" element={<CompressPage />} />
                  <Route path="/pdf-compress" element={<PdfCompressPage />} />
                  <Route path="/color-palette" element={<ColorPalettePage />} />
                  <Route path="/converter" element={<ConverterPage />} />
                  <Route path="/svg-optimizer" element={<SvgOptimizerPage />} />
                  <Route path="/og-image" element={<OgImagePage />} />
                  <Route path="/watermark" element={<WatermarkPage />} />
                  <Route path="/remove-bg" element={<BgRemovePage />} />
                  <Route
                    path="/instagram-extractor"
                    element={<Navigate to="/extractor" replace />}
                  />
                  <Route path="/qrcode" element={<QRCodePage />} />
                  <Route path="/grid-paint" element={<GridPaintPage />} />
                  <Route path="/3d-studio" element={<Studio3DPage />} />
                  <Route path="/image-lab" element={<ImageLabPage />} />
                  <Route path="/cmyk-halftone" element={<Navigate to="/image-lab" replace />} />
                  <Route path="/texture-filter" element={<Navigate to="/image-lab" replace />} />
                  <Route
                    path="/grid-machine"
                    element={
                      <DesktopOnlyGate toolName="Grid Machine">
                        <GridMachinePage />
                      </DesktopOnlyGate>
                    }
                  />
                  <Route path="/riso-machine" element={<Navigate to="/image-lab" replace />} />
                  <Route path="/labs" element={<LabsPage />} />
                  <Route
                    path="/labs/wind-tunnel"
                    element={
                      <DesktopOnlyGate toolName="Wind Tunnel">
                        <WindTunnelPage />
                      </DesktopOnlyGate>
                    }
                  />
                  <Route path="/labs/benchmark" element={<BenchmarkArenaPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/onboard" element={<OnboardPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/brand-guidelines" element={<BrandGuidelinesPage />} />
                  <Route path="/brand/:slug" element={<PublicBrandGuideline />} />
                  <Route path="/design-system" element={<DesignSystemPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/developer" element={<DeveloperPortalPage />} />
                  <Route path="/settings/api-keys" element={<ApiKeysPage />} />
                  <Route path="/settings/connected-apps" element={<ConnectedAppsPage />} />
                  <Route path="/developer/usage" element={<UsageDashboardPage />} />
                  <Route path="/developer/getting-started" element={<GettingStartedPage />} />
                  <Route path="/connect/:token" element={<ConnectPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth" element={<AuthCallbackPage />} />
                  <Route path="/waitlist" element={<WaitlistPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/welcome" element={<OnboardingWizardPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/chat" element={<AdminChatPage />} />
                  <Route path="/admin/presets" element={<AdminPresetsPage />} />
                  <Route path="/admin/products" element={<AdminProductsPage />} />
                  <Route path="/admin/smart-analyzer" element={<SmartAnalyzerPage />} />

                  <Route path="/create" element={<CreatePage />} />
                  <Route path="/create/projects" element={<CreativeProjectsPage />} />
                  <Route path="/content-studio" element={<ContentStudioPage />} />
                  <Route
                    path="/playground"
                    element={
                      <PremiumGate toolName="Playground">
                        <PlaygroundPage />
                      </PremiumGate>
                    }
                  />
                  <Route
                    path="/playground/explore"
                    element={
                      <PremiumGate toolName="Playground">
                        <PlaygroundGalleryPage />
                      </PremiumGate>
                    }
                  />
                  <Route path="/playground/shared/:shareId" element={<PlaygroundSharedPage />} />
                  <Route
                    path="/playground/:slug"
                    element={
                      <PremiumGate toolName="Playground">
                        <PlaygroundPage />
                      </PremiumGate>
                    }
                  />
                  <Route
                    path="/community"
                    element={
                      <PremiumGate toolName="Community">
                        <CommunityPage />
                      </PremiumGate>
                    }
                  />
                  <Route
                    path="/community/presets"
                    element={
                      <PremiumGate toolName="Community">
                        <CommunityPresetsPage />
                      </PremiumGate>
                    }
                  />
                  <Route path="/profile/:identifier" element={<CommunityProfilePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundaryWrapper>
          </Layout>
        </ActiveBrandKitProvider>
      </CanvasHeaderProvider>
    </ErrorBoundaryWrapper>
  );
};

export default App;
