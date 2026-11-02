import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LandingPage from "./pages/LandingPage";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";

const Signin = lazy(() => import("./pages/Auth/Signin"));
const Signup = lazy(() => import("./pages/Auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/Auth/ForgotPassword"));
const PasswordReset = lazy(() => import("./pages/Auth/PasswordReset"));
const EmailCode = lazy(() => import("./pages/Auth/EmailCode"));
const PhoneCode = lazy(() => import("./pages/Auth/PhoneCode"));
const PhoneVerification = lazy(() => import("./pages/Auth/PhoneVerification"));
const VerifyMail = lazy(() => import("./pages/Auth/VerifyMail"));
const VerifyResetRequest = lazy(() => import("./pages/Auth/VerifyResetRequest"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ImpactPage = lazy(() => import("./pages/ImpactPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Support = lazy(() => import("./pages/Support"));
const TrafficReport = lazy(() => import("./pages/TrafficReport"));
const TransparencyReport = lazy(() => import("./pages/TransparencyReport"));
const Consulting = lazy(() => import("./pages/Consulting"));
const DisasterPage = lazy(() => import("./pages/DisasterPage"));
const Donations = lazy(() => import("./components/Donations"));
const PlantTree = lazy(() => import("./components/PlantTree"));
const TreeProjectAdmin = lazy(() => import("./components/TreeProjectAdmin"));
const PublicProjectView = lazy(() => import("./components/PublicProjectView"));
const MyCertificates = lazy(() => import("./pages/MyCertificates"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

const AuthSharedLayout = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthSharedLayout }))
);
const AuthMainfeed = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthMainfeed }))
);
const AuthCommunity = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthCommunity }))
);
const AuthNotification = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthNotification }))
);
const AuthProfile = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthProfile }))
);
const AuthComment = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthComment }))
);
const AuthWaverX = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthWaverX }))
);
const AuthCampaigns = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthCampaigns }))
);
const AuthDisasters = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthDisasters }))
);
const AuthUploadCover = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthUploadCover }))
);
const AuthUploadPhoto = lazy(() =>
  import("./pages/AuthenticatedPages").then((m) => ({ default: m.AuthUploadPhoto }))
);

const OnboardingLayout = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.OnboardingLayout }))
);
const Welcome = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Welcome }))
);
const Home = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Home }))
);
const OnboardingCampaign = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Campaign }))
);
const OnboardingNotification = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Notifications }))
);
const OnboardingProfile = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Profile }))
);
const OnboardingCommunity = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Community }))
);
const OnboardingDisasters = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Disasters }))
);
const OnboardingChatbot = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Chatbot }))
);
const BotLeg = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.BotLeg }))
);
const GrabLeg = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.GrabLeg }))
);
const OnboardingDonate = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Donate }))
);
const OnboardingWaverX = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.WaverX }))
);
const OnboardingPlantTree = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.PlantTree }))
);
const OnboardingTreeAdmin = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.TreeAdmin }))
);

function RouteFallback() {
  return <div className="min-h-[100dvh] bg-background" />;
}

function App() {
  return (
    <HelmetProvider>
      <div>
        <ToastContainer />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/bot" element={<AuthWaverX />} />
              <Route path="/campaigns" element={<AuthCampaigns />} />
              <Route path="/disasters/:disasterId" element={<DisasterPage />} />
              <Route path="/disasters" element={<AuthDisasters />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/impact" element={<ImpactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="/support" element={<Support />} />
              <Route path="/traffic-report" element={<TrafficReport />} />
              <Route path="/transparency-report" element={<TransparencyReport />} />
              <Route path="/consulting" element={<Consulting />} />
              <Route path="/project" element={<PublicProjectView />} />
              <Route path="/app" element={<AuthSharedLayout />}>
                <Route index element={<AuthMainfeed />} />
                <Route path="/app/community" element={<AuthCommunity />} />
                <Route path="/app/notifications" element={<AuthNotification />} />
                <Route path="/app/waverx" element={<AuthWaverX />} />
                <Route path="/app/donations" element={<Donations />} />
                <Route
                  path="/app/plant-tree"
                  element={
                    <ProtectedRoute>
                      <PlantTree />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/my-certificates"
                  element={
                    <ProtectedRoute>
                      <MyCertificates />
                    </ProtectedRoute>
                  }
                />
                <Route path="/app/admin/tree-projects" element={<TreeProjectAdmin />} />
                <Route path="/app/:userId/profile" element={<AuthProfile />} />
                <Route path="/app/:postId/comments" element={<AuthComment type={"post"} />} />
                <Route
                  path="/app/:postId/:commentId/comments"
                  element={<AuthComment type={"comments"} />}
                />
                <Route path="/app/post/:postId" element={<AuthComment type={"post"} />} />
              </Route>
              <Route path="/onboarding" element={<OnboardingLayout />}>
                <Route index element={<Welcome />} />
                <Route path="/onboarding/bot" element={<OnboardingChatbot />} />
                <Route path="/onboarding/campaigns" element={<OnboardingCampaign />} />
                <Route path="/onboarding/home" element={<Home />} />
                <Route path="/onboarding/community" element={<OnboardingCommunity />} />
                <Route path="/onboarding/notifications" element={<OnboardingNotification />} />
                <Route path="/onboarding/disasters" element={<OnboardingDisasters />} />
                <Route path="/onboarding/profile" element={<OnboardingProfile />} />
                <Route path="/onboarding/donate" element={<OnboardingDonate />} />
                <Route path="/onboarding/waverx" element={<OnboardingWaverX />} />
                <Route path="/onboarding/plant-tree" element={<OnboardingPlantTree />} />
                <Route path="/onboarding/tree-admin" element={<OnboardingTreeAdmin />} />
                <Route path="/onboarding/grableg" element={<GrabLeg />} />
                <Route path="/onboarding/botleg" element={<BotLeg />} />
              </Route>
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Signin />} />
              <Route path="/verifypasswordreset/:uid/:token" element={<VerifyResetRequest />} />
              <Route path="/forgotpassword" element={<ForgotPassword />} />
              <Route path="/emailcode" element={<EmailCode />} />
              <Route path="/resetpassword" element={<PasswordReset />} />
              <Route path="/phonecode" element={<PhoneCode />} />
              <Route path="/verifyphone" element={<PhoneVerification />} />
              <Route path="/verifymail" element={<VerifyMail />} />
              <Route path="/uploadphoto" element={<AuthUploadPhoto />} />
              <Route path="/uploadcover" element={<AuthUploadCover />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </div>
    </HelmetProvider>
  );
}

export default App;
