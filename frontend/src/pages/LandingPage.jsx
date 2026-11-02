import masked from "../assets/images/maskedEmo.png";
import menu from "../assets/Icons/menu.svg";
import fb from "../assets/Icons/fb.webp";
import exx from "../assets/Icons/x.png";
import linkedIn from "../assets/Icons/lin.webp";
import yt from "../assets/Icons/yt.svg";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { LandingPageSEO } from "../components/SEOComponents";
import { SITE } from "../config/site";
import { fetchDisasters, fetchTreeStats, mapDisasterForMap, buildLiveCharts, formatTimeAgo } from "../utils/apiData";

const LeafletMap = lazy(() => import("../components/LeafletMap"));
const DonationForm = lazy(() => import("../components/DonationForm"));
const LandingCharts = lazy(() => import("../components/LandingCharts"));

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showDisasterMap, setShowDisasterMap] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const heroSlides = [
    {
      id: 1,
      image: "/ai-disaster.jpg",
      imageSm: "/ai-disaster-sm.jpg",
      title: "AI-Powered",
      subtitle: "Disaster Detection",
      description: "Live USGS and NASA events, built in Nairobi to verify disaster information instead of shouting it louder.",
    },
    {
      id: 2,
      image: "/environment.jpg",
      imageSm: "/environment-sm.jpg",
      title: "Environmental",
      subtitle: "Monitoring",
      description: "Track climate pressure and environmental hazards as they appear in the live feeds.",
    },
    {
      id: 3,
      image: "/emergency-response.jpg",
      imageSm: "/emergency-response-sm.jpg",
      title: "Emergency",
      subtitle: "Response",
      description: "Coordinate with community networks for faster disaster response.",
    },
    {
      id: 4,
      image: "/community-respond.jpg",
      imageSm: "/community-respond-sm.jpg",
      title: "Community",
      subtitle: "Protection",
      description: "Real-time monitoring and coordinated emergency response for local communities.",
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  useEffect(() => {
    const locked = isMobileMenuOpen || showDisasterMap || showDonationModal;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen, showDisasterMap, showDonationModal]);

  const [allDisasters, setAllDisasters] = useState([]);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);
  const [liveError, setLiveError] = useState("");
  const [platformStats, setPlatformStats] = useState({
    total_trees_planted: 0,
    active_projects: 0,
    verified_projects: 0,
    total_funds_raised: 0,
    disaster_count: 0,
  });

  const disasterData = useMemo(
    () => allDisasters.map(mapDisasterForMap).filter(Boolean),
    [allDisasters]
  );
  const liveCharts = useMemo(() => buildLiveCharts(allDisasters), [allDisasters]);
  const recentEvents = useMemo(
    () =>
      [...allDisasters]
        .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
        .slice(0, 8),
    [allDisasters]
  );

  useEffect(() => {
    let active = true;
    const loadLive = () => {
      Promise.allSettled([fetchDisasters(), fetchTreeStats()]).then(([disastersResult, statsResult]) => {
        if (!active) return;
        const disasters = disastersResult.status === "fulfilled" ? disastersResult.value : [];
        const stats = statsResult.status === "fulfilled" ? statsResult.value : {};
        setAllDisasters(disasters);
        setLiveUpdatedAt(new Date());
        setLiveError(disastersResult.status === "rejected" ? "Could not refresh live disaster feeds." : "");
        setPlatformStats({
          total_trees_planted: stats.total_trees_planted || 0,
          active_projects: stats.active_projects || 0,
          verified_projects: stats.verified_projects || 0,
          total_funds_raised: stats.total_funds_raised || 0,
          disaster_count: disasters.length,
        });
      });
    };
    const startLive = () => {
      if (!active) return;
      loadLive();
    };
    let idleId;
    let timeoutId;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startLive, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(startLive, 400);
    }
    const timer = setInterval(loadLive, 60000);
    return () => {
      active = false;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
      clearInterval(timer);
    };
  }, []);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  return (
    <>
      <LandingPageSEO />
      <main className="min-h-[100dvh] bg-background overflow-x-hidden">
      {/* Modern Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/">
                  <img alt="Climate Wavers" src="/logo.jpg" className="h-9 sm:h-11 w-auto" width="44" height="44" fetchPriority="high" decoding="async" />
                </Link>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <Link to="/" className={`${isScrolled ? 'text-[#067d83] hover:text-[#055a5f]' : 'text-white hover:text-[#4F6F6F]'} px-3 py-2 text-sm font-medium transition-colors`}>Home</Link>
                <Link to="/about" className={`${isScrolled ? 'text-[#067d83] hover:text-[#055a5f]' : 'text-white hover:text-[#4F6F6F]'} px-3 py-2 text-sm font-medium transition-colors`}>About</Link>
                <Link to="/impact" className={`${isScrolled ? 'text-[#067d83] hover:text-[#055a5f]' : 'text-white hover:text-[#4F6F6F]'} px-3 py-2 text-sm font-medium transition-colors`}>Impact</Link>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setShowDisasterMap(true)}
                className="hidden md:inline-flex items-center h-10 px-3 text-sm font-medium text-destructive hover:bg-surface"
                title="Emergency Disaster Alert"
              >
                Alerts
              </button>

              {/* Donate Button */}
              <button 
                onClick={() => setShowDonationModal(true)}
                className="hidden md:flex items-center px-3 py-1.5 bg-[#067d83] text-white rounded-md hover:bg-[#055a5f] transition-colors text-sm font-medium"
              >
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                Donate
              </button>

              {/* Plant Tree Button */}
              <a 
                href="/app/plant-tree"
                className="hidden md:flex items-center px-3 py-1.5 bg-[#067d83] text-white rounded-md hover:bg-[#055a5f] transition-colors text-sm font-medium"
              >
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2L8 4h2l2-2h-2zm-2 4L6 8h2l2-2h-2zm4 0L14 8h-2l-2-2h2zm-2 4L10 12h2l2-2h-2zm4 0L18 12h-2l-2-2h2zm-8 4L6 16h2l2-2h-2zm4 0L10 16h2l2-2h-2zm4 0L18 16h-2l-2-2h2z" clipRule="evenodd" />
                </svg>
                Plant Tree
              </a>

              <a href="/login" className={`hidden md:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${isScrolled ? 'text-[#067d83] hover:text-[#055a5f]' : 'text-white hover:text-[#4F6F6F]'}`}>
                Sign In
              </a>
              <a href="/signup" className="hidden md:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#067d83] hover:bg-[#055a5f] transition-colors">
                Get Started
              </a>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden min-h-11 min-w-11 p-2 hover:bg-surface"
                aria-label="Open menu"
              >
                <img src={menu} alt="menu" className={`w-6 h-6 ${isScrolled ? 'filter brightness-0 saturate-100' : 'filter brightness-0 invert'}`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          {/* Menu Panel */}
          <div className="absolute top-0 right-0 w-[min(80vw,320px)] h-full bg-surface border-l border-border overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-[#067d83]">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Navigation Links */}
            <div className="p-4 space-y-2">
              <Link 
                to="/" 
                className="block px-4 py-3 text-[#067d83] hover:bg-gray-100 rounded-lg transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/about" 
                className="block px-4 py-3 text-[#067d83] hover:bg-gray-100 rounded-lg transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                to="/impact" 
                className="block px-4 py-3 text-[#067d83] hover:bg-gray-100 rounded-lg transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Impact
              </Link>
              
              {/* Donate Button for Mobile */}
              <button 
                onClick={() => {
                  setShowDonationModal(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center px-4 py-2 bg-[#067d83] text-white rounded-lg hover:bg-[#055a5f] transition-colors duration-200 mt-4 text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                Donate
              </button>

              {/* Plant Tree Button for Mobile */}
              <Link 
                to="/app/plant-tree"
                className="w-full flex items-center justify-center px-4 py-2 bg-[#067d83] text-white rounded-lg hover:bg-[#055a5f] transition-colors duration-200 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2L8 4h2l2-2h-2zm-2 4L6 8h2l2-2h-2zm4 0L14 8h-2l-2-2h2zm-2 4L10 12h2l2-2h-2zm4 0L18 12h-2l-2-2h2zm-8 4L6 16h2l2-2h-2zm4 0L10 16h2l2-2h-2zm4 0L18 16h-2l-2-2h2z" clipRule="evenodd" />
                </svg>
                Plant Tree
              </Link>
              
              {/* Emergency Alert Button for Mobile */}
              <button 
                onClick={() => {
                  setShowDisasterMap(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Emergency Alert
              </button>
              
              {/* Auth Links */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <a 
                  href="/login" 
                  className="block px-4 py-3 text-[#067d83] hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </a>
                <a 
                  href="/signup" 
                  className="block px-4 py-3 bg-[#067d83] text-white rounded-lg hover:bg-[#055a5f] transition-colors duration-200 text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <section id="home" className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={slide.imageSm}
                srcSet={`${slide.imageSm} 960w, ${slide.image} 1600w`}
                sizes="100vw"
                alt={`Disaster alert system - ${slide.title}`}
                className="w-full h-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "low"}
                decoding={index === 0 ? "sync" : "async"}
              />
              <div className="absolute inset-0 bg-black/55"></div>
            </div>
          ))}
        </div>

        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-3 hidden md:block"
          aria-label="Previous slide"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-3 hidden md:block"
          aria-label="Next slide"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pb-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-4 leading-tight">
              <span className="block">{heroSlides[currentSlide].title}</span>
              <span className="block">{heroSlides[currentSlide].subtitle}</span>
            </h1>
            <p className="text-base sm:text-lg text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
              {heroSlides[currentSlide].description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center mb-8 w-full max-w-md mx-auto sm:max-w-none">
              <a href="/signup" className="min-h-11 bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-3 text-base font-medium flex items-center justify-center">
                Create an account
              </a>
              <a href="/login" className="min-h-11 border border-white text-white hover:bg-white hover:text-foreground px-6 py-3 text-base font-medium flex items-center justify-center">
                Sign in
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-8 text-white/85">
              <span className="text-sm">{Number(platformStats.disaster_count).toLocaleString()} live disaster reports</span>
              <span className="text-sm">{Number(platformStats.total_trees_planted).toLocaleString()} trees planted</span>
              <span className="text-sm">{Number(platformStats.active_projects).toLocaleString()} active projects</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2.5 w-2.5 ${
                index === currentSlide ? "bg-white" : "bg-white/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Impact Section with Statistics and Charts */}
      <section id="impact" className="py-16 sm:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-medium text-primary mb-3">Live monitoring</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Current disaster activity
            </h2>
            <p className="text-base sm:text-lg text-muted max-w-3xl mx-auto">
              Charts, the map, and the activity feed update from USGS earthquakes and NASA EONET events every 60 seconds.
              {liveUpdatedAt ? ` Last refresh ${liveUpdatedAt.toLocaleTimeString()}.` : ""}
            </p>
            {liveError ? <p className="mt-3 text-sm text-destructive">{liveError}</p> : null}
        </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-16">
            <div className="bg-surface border border-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">
                {Number(platformStats.disaster_count).toLocaleString()}
              </div>
              <div className="text-muted text-sm mt-1">Disaster reports</div>
            </div>
            <div className="bg-surface border border-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">
                {Number(platformStats.total_trees_planted).toLocaleString()}
              </div>
              <div className="text-muted text-sm mt-1">Trees planted</div>
            </div>
            <div className="bg-surface border border-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">
                {Number(platformStats.active_projects).toLocaleString()}
              </div>
              <div className="text-muted text-sm mt-1">Active projects</div>
            </div>
            <div className="bg-surface border border-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">
                ${Number(platformStats.total_funds_raised).toLocaleString()}
              </div>
              <div className="text-muted text-sm mt-1">Funds raised</div>
            </div>
          </div>

          <Suspense fallback={<p className="text-sm text-muted mb-6">Loading live charts.</p>}>
            <LandingCharts liveCharts={liveCharts} allDisasters={allDisasters} recentEvents={recentEvents} />
          </Suspense>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-surface border border-border p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">{disasterData.length}</div>
              <div className="text-sm text-muted mt-1">Events with map coordinates</div>
            </div>
            <div className="bg-surface border border-border p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">
                {allDisasters.filter((event) => String(event.severity).toUpperCase() === "CRITICAL" || String(event.severity).toUpperCase() === "HIGH").length}
              </div>
              <div className="text-sm text-muted mt-1">High or critical events</div>
            </div>
            <div className="bg-surface border border-border p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-semibold text-primary">
                {liveUpdatedAt ? liveUpdatedAt.toLocaleTimeString() : "--"}
              </div>
              <div className="text-sm text-muted mt-1">Last feed refresh</div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-16 sm:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="order-2 lg:order-1 relative overflow-hidden">
              <img
                src={masked}
                alt="Advanced disaster response technology"
                className="w-full h-64 sm:h-80 lg:h-[420px] object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute top-4 right-4 bg-surface border border-border p-3">
                <div className="text-xl font-semibold text-primary">{allDisasters.length}</div>
                <div className="text-xs text-muted">Live events</div>
              </div>
              <div className="absolute bottom-4 left-4 bg-surface border border-border p-3">
                <div className="text-xl font-semibold text-primary">{disasterData.length}</div>
                <div className="text-xs text-muted">Mapped locations</div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <p className="text-sm font-medium text-primary mb-3">Origin</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-5 leading-tight">
                Built in Nairobi to verify alerts, not amplify them
              </h2>
              <p className="text-base text-muted mb-8 leading-relaxed">
                Climate Wavers is the live platform. FlowOps Africa is the lab. USGS and NASA feeds are on the map today.
                The endgame is AI that labels what is confirmed, what is rumor, and what still needs a human.
              </p>
              <div className="space-y-5 mb-8">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Live official feeds</h3>
                  <p className="text-muted text-sm">USGS earthquakes and NASA EONET events, refreshed every 60 seconds, with the source attached.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Human review before send</h3>
                  <p className="text-muted text-sm">High-impact alerts wait for a person. Fluent AI is not treated as a siren.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Community on the same map</h3>
                  <p className="text-muted text-sm">Tree campaigns, reports, and WaverX sit next to the live events.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/about" className="inline-flex items-center min-h-11 px-5 py-2.5 bg-primary text-primary-foreground font-medium">
                  Read the story
                </Link>
                <Link to="/impact" className="inline-flex items-center min-h-11 px-5 py-2.5 border border-primary text-primary font-medium">
                  See live impact
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <p className="text-sm font-medium text-primary mb-3">The path</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Origin. Live impact. Endgame.
            </h2>
            <p className="text-muted">
              One product, one lab, one rule: do not treat a confident sentence as a confirmed disaster.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="border border-border bg-surface p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">01 Origin</p>
              <h3 className="mt-3 text-xl font-semibold">Nairobi question</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                FlowOps Africa started Climate Wavers because disaster information is a high-stakes AI problem.
                Incomplete networks. Mixed languages. Rumors that travel faster than USGS or NASA.
              </p>
            </article>
            <article className="border border-border bg-surface p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">02 Now</p>
              <h3 className="mt-3 text-xl font-semibold">The platform is live</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {Number(platformStats.disaster_count).toLocaleString()} current events on the map from official feeds.
                Tree campaigns from published records. No invented lives saved.
              </p>
            </article>
            <article className="border border-border bg-surface p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">03 Endgame</p>
              <h3 className="mt-3 text-xl font-semibold">Verify, then send</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Evidence checks. Uncertainty labels. Source tracking. Human review. The research is a controlled
                experiment. The destination is alerts a community can act on.
              </p>
              <a
                href={SITE.org.researchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex mt-4 text-sm text-primary"
              >
                Read the verification research
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-3">
              Latest verified events
            </h2>
            <p className="text-muted max-w-3xl mx-auto">
              These cards are the newest events from the live USGS and NASA feeds, not sample quotes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentEvents.slice(0, 3).map((event) => (
              <article key={event.id} className="bg-background border border-border p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{event.disasterType}</p>
                <h3 className="mt-2 font-semibold text-foreground">{event.title || event.name}</h3>
                <p className="mt-2 text-sm text-muted line-clamp-3">{event.description}</p>
                <p className="mt-3 text-xs text-muted">
                  {formatTimeAgo(event.startDate)} {event.source ? `(${event.source})` : ""}
                </p>
              </article>
            ))}
            {!recentEvents.length ? (
              <p className="text-sm text-muted">Live events will appear here after the feeds load.</p>
            ) : null}
          </div>
        </div>
      </section>


      <section className="py-16 sm:py-24 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-sm font-medium text-white/80 mb-3">Our commitment</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-4">
              Protecting communities by refusing fake certainty
            </h2>
            <p className="text-base text-white/85 max-w-3xl mx-auto">
              Live official feeds today. Verification research from Nairobi as the next layer. Communities get time, sources, and a clear line between confirmed and unconfirmed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="border border-white/20 p-5">
              <h3 className="text-lg font-semibold text-white mb-2">Early warning</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                USGS and NASA feeds give communities earlier visibility when disasters are active.
              </p>
            </div>
            <div className="border border-white/20 p-5">
              <h3 className="text-lg font-semibold text-white mb-2">Community response</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                Reports, campaigns, and tree projects sit next to the live map so people can act locally.
              </p>
            </div>
            <div className="border border-white/20 p-5">
              <h3 className="text-lg font-semibold text-white mb-2">Climate action</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                Tree-planting campaigns run alongside monitoring, not as a separate story.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                src: "/emergency-response-sm.jpg",
                title: "Flood response",
                caption: "Homes behind an emergency barrier during flooding",
              },
              {
                src: "/community-respond-sm.jpg",
                title: "Fire response",
                caption: "Crews working a burned structure after a fire",
              },
              {
                src: "/ai-disaster-sm.jpg",
                title: "Emergency coordination",
                caption: "Fire units on scene during an active incident",
              },
              {
                src: "/environment-sm.jpg",
                title: "Climate pressure",
                caption: "Waste and pollution the tree campaigns work against",
              },
            ].map((photo) => (
              <figure key={photo.src} className="overflow-hidden border border-white/20 bg-primary-dark">
                <img src={photo.src} alt={photo.caption} className="w-full h-52 sm:h-64 object-cover" loading="lazy" decoding="async" />
                <figcaption className="p-4">
                  <h4 className="text-white font-semibold">{photo.title}</h4>
                  <p className="text-white/80 text-sm mt-1">{photo.caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/about" className="inline-flex items-center min-h-11 px-6 py-3 bg-white text-primary font-medium">
              Learn more about our mission
            </Link>
          </div>
        </div>
      </section>



      <footer className="relative text-white overflow-hidden bg-[#2F4F4F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
          {/* Partners Section */}
          <div className="mb-12 md:mb-16">
            <h3 className="text-xl md:text-2xl font-bold text-center mb-6 md:mb-8 text-white">Trusted by Global Partners</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-4 md:gap-6 lg:gap-8 items-center justify-items-center">
              {/* Red Cross */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/red-cross.jpg" alt="Red Cross" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">Red Cross</div>
              </div>
              
              {/* World Bank */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/world-bank.webp" alt="World Bank" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">World Bank</div>
              </div>
              
              {/* UNFCCC */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/unfcc.png" alt="UNFCCC" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">UNFCCC</div>
              </div>
              
              {/* UNDP */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/undp.png" alt="UNDP" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">UNDP</div>
              </div>
              
              {/* Green Climate Fund */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/gef.png" alt="Green Climate Fund" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">Green Climate Fund</div>
              </div>
              
              {/* UN Environment Programme */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/unep.png" alt="UNEP" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">UNEP</div>
              </div>
              
              {/* World Health Organization */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/who.png" alt="WHO" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">WHO</div>
              </div>
              
              {/* International Federation of Red Cross */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/IFRC.png" alt="IFRC" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">IFRC</div>
              </div>
              
              {/* UNN */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <img src="/unn.png" alt="UNN" className="h-6 md:h-8 w-auto mx-auto" loading="lazy" decoding="async" />
                <div className="text-white text-xs text-center mt-1">UNN</div>
              </div>
              
              {/* Global Environment Facility */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <div className="text-white font-bold text-xs md:text-sm text-center">
                  <div className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-1 md:mb-2 bg-teal-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">GEF</span>
                  </div>
                  <div className="hidden sm:block">GEF</div>
                  <div className="sm:hidden text-xs">GEF</div>
                </div>
              </div>
              
              {/* Climate Action Network */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <div className="text-white font-bold text-xs md:text-sm text-center">
                  <div className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-1 md:mb-2 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">CAN</span>
                  </div>
                  <div className="hidden sm:block">Climate Action Network</div>
                  <div className="sm:hidden text-xs">CAN</div>
                </div>
              </div>
              
              {/* World Meteorological Organization */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 hover:bg-white/20 w-full max-w-[120px]">
                <div className="text-white font-bold text-xs md:text-sm text-center">
                  <div className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-1 md:mb-2 bg-cyan-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">WMO</span>
                  </div>
                  <div className="hidden sm:block">WMO</div>
                  <div className="sm:hidden text-xs">WMO</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
            {/* Company Info */}
            <div className="col-span-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center mb-4 md:mb-6">
                <img alt="logo" src="/logo.jpg" className="h-8 md:h-10 w-auto mr-0 sm:mr-4 mb-2 sm:mb-0" />
                <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-[#067d83]">Climate Wavers</h3>
              </div>
              <p className="text-gray-300 mb-6 md:mb-8 max-w-lg text-sm md:text-base lg:text-lg leading-relaxed">
                Live USGS and NASA monitoring from Nairobi. Verify disaster alerts. Do not amplify them.
              </p>
              
              {/* Newsletter */}
              <div className="mb-6 md:mb-8">
                <h4 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-white">Stay Updated</h4>
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <input
                  type="email"
                    placeholder="Enter your email address"
                    className="px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#067d83] focus:border-transparent backdrop-blur-sm text-sm md:text-base"
                />
                  <button type="button" className="bg-primary hover:bg-primary-dark text-primary-foreground px-4 md:px-6 py-2 md:py-3 text-sm md:text-base min-h-11">
                  Subscribe
                </button>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h4 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-white">Follow Us</h4>
                <div className="flex flex-wrap gap-2 md:gap-4">
                  <a 
                    href="https://facebook.com/climatewavers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-11 h-11 bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center"
                    aria-label="Follow us on Facebook"
                  >
                    <img src={fb} alt="Facebook" className="w-4 h-4 md:w-6 md:h-6 filter brightness-0 invert" />
                  </a>
                  <a 
                    href="https://youtube.com/@climatewavers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-11 h-11 bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center"
                    aria-label="Subscribe to our YouTube channel"
                  >
                    <img src={yt} alt="YouTube" className="w-4 h-4 md:w-6 md:h-6 filter brightness-0 invert" />
                  </a>
                  <a 
                    href="https://x.com/climatewavers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-11 h-11 bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center"
                    aria-label="Follow us on X (Twitter)"
                  >
                    <img src={exx} alt="X" className="w-4 h-4 md:w-6 md:h-6 filter brightness-0 invert" />
                  </a>
                  <a 
                    href="https://linkedin.com/company/climatewavers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-11 h-11 bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center"
                    aria-label="Connect with us on LinkedIn"
                  >
                    <img src={linkedIn} alt="LinkedIn" className="w-4 h-4 md:w-6 md:h-6" />
                  </a>
                </div>
              </div>
        </div>

            {/* Information */}
            <div className="min-w-0">
              <h4 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-white">Information</h4>
              <ul className="space-y-2">
                <li><Link to="/traffic-report" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">Traffic Report</Link></li>
                <li><Link to="/transparency-report" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">Transparency Report</Link></li>
                <li><Link to="/faq" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">FAQ</Link></li>
                <li><Link to="/privacy-policy" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">Privacy Policy</Link></li>
          </ul>
        </div>

            {/* Services */}
            <div className="min-w-0">
              <h4 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-white">Services</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">About Us</Link></li>
                <li><Link to="/contact" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">Contact Us</Link></li>
                <li><Link to="/consulting" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">Consulting</Link></li>
                <li><Link to="/support" className="text-gray-300 hover:text-[#067d83] transition-colors text-sm md:text-base">Support</Link></li>
          </ul>
        </div>
          </div>

          {/* Bottom section */}
          <div className="border-t border-gray-700 mt-8 md:mt-12 pt-6 md:pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
              <p className="text-gray-400 text-xs md:text-sm mb-2 md:mb-0">
                © {new Date().getFullYear()} Climate Wavers
              </p>
            </div>
          </div>
        </div>
      </footer>

      {showDisasterMap && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-6xl bg-surface overflow-hidden flex flex-col">
            <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 border-b border-border">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-foreground">Live disaster map</h2>
                <p className="text-xs sm:text-sm text-muted">
                  {disasterData.length} mapped events
                  {liveUpdatedAt ? ` · ${liveUpdatedAt.toLocaleTimeString()}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDisasterMap(false)}
                className="min-h-11 min-w-11 shrink-0 hover:bg-background"
                aria-label="Close map"
              >
                <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative flex-1 min-h-[70dvh] sm:min-h-[70vh] bg-background">
              <Suspense fallback={<p className="p-4 text-sm text-muted">Loading map.</p>}>
                <LeafletMap disasters={disasterData} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {showDonationModal && (
        <Suspense fallback={null}>
          <DonationForm onClose={() => setShowDonationModal(false)} />
        </Suspense>
      )}
    </main>
    </>
  );
};

export default LandingPage;

