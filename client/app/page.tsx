"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {  
  getCurrentUser, 
  logoutUser,
  sendSignupOTP,
  sendLoginOTP,
} from '@/lib/api'
import { 
  ChevronRight, 
  MessageCircle,
  Zap,
  Shield,
  Users,
  TrendingUp,
  Files,
  CircuitBoard,
  BarChart3,
  Headphones,
  ArrowUp,
  Sparkles
} from 'lucide-react'
import { useTheme } from 'next-themes'
import HeroSection from '@/components/HeroSection'
import FeatureBar from '@/components/FeatureBar'
import ContactsSection from '@/components/ContactsSection'
import DashboardLayout from '@/components/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const industrySlides = [
  [
    {
      img: '/travel.webp',
      bg: 'bg-gradient-to-b from-green-25 to-green-50',
      title: 'Travel & Tourism',
      points: [
        'Automated booking confirmations',
        'Personalized travel offers',
        '24/7 customer support',
      ],
    },
    {
      img: '/education.webp',
      bg: 'bg-gradient-to-b from-orange-25 to-orange-50',
      title: 'Education',
      points: [
        'Course updates & reminders',
        'Student engagement',
        'Fee payment notifications',
      ],
    },
    {
      img: '/spa.webp',
      bg: 'bg-gradient-to-b from-blue-25 to-blue-50',
      title: 'Spa & Salons',
      points: [
        'Appointment reminders',
        'Promotional offers',
        'Customer feedback',
      ],
    },
  ],
  [
    {
      img: '/travel.webp',  // Changed from '/industry-ecommerce.png'
      bg: 'bg-gradient-to-b from-green-25 to-green-50',
      title: 'E-commerce',
      points: [
        'Order updates',
        'Abandoned cart recovery',
        'Customer support',
      ],
    },
    {
      img: '/education.webp',  // Changed from '/industry-banking.png'
      bg: 'bg-gradient-to-b from-orange-25 to-orange-50',
      title: 'Banking & Finance',
      points: [
        'Transaction alerts',
        'Loan reminders',
        'Customer onboarding',
      ],
    },
    {
      img: '/spa.webp',  // Changed from '/industry-restaurant.png'
      bg: 'bg-gradient-to-b from-blue-25 to-blue-50',
      title: 'Restaurants & Food Businesses',
      points: [
        'Reservation confirmations',
        'Menu promotions',
        'Order tracking',
      ],
    },
  ],
];

export default function HomePage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [slide, setSlide] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeData, setWelcomeData] = useState({ firstName: '', isSignup: false });
  
  // Form state for login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Form state for signup
  const [signupEmail, setSignupEmail] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // OTP flow states
  const [showSignupOTP, setShowSignupOTP] = useState(false);
  const [showLoginOTP, setShowLoginOTP] = useState(false);
  const [showGoogleOTP, setShowGoogleOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [tempSignupData, setTempSignupData] = useState<{
    password: string;
    name: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Add a useState/useEffect for isDark (document.documentElement.classList.contains('dark'))
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Add the missing handleLogin function
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    
    console.log('Login attempt:', { email: loginEmail, hasPassword: !!loginPassword });
    
    try {
      // First step: Send OTP for login
      const response = await sendLoginOTP({
        email: loginEmail,
        password: loginPassword
      });
      
      console.log('Login OTP response:', response);
      
      // Second step: Show OTP verification
      setOtpEmail(loginEmail);
      setShowLoginOTP(true);
      setLoginError('');
      
      // Show helpful message for Google users
      if (response.message && response.message.includes('Google')) {
        setLoginError('Password created successfully! You can now login with email/password or continue using Google login.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await (logoutUser as any)();
      setIsLoggedIn(false);
      // Clear any stored user data
      setWelcomeData({ firstName: '', isSignup: false });
      setShowWelcomePopup(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // OTP success handlers
  const handleSignupOTPSuccess = (data: any) => {
    console.log('Signup OTP success:', data);
    setIsLoggedIn(true);
    setShowSignupOTP(false);
    setTempSignupData(null);
    
    // Show welcome popup for signup
    setWelcomeData({ 
      firstName: data?.user?.firstName || 'User', 
      isSignup: true 
    });
    setShowWelcomePopup(true);
    
    // Auto-hide popup after 4 seconds
    setTimeout(() => {
      setShowWelcomePopup(false);
    }, 4000);
  };

  const handleLoginOTPSuccess = (data: any) => {
    console.log('Login OTP success:', data);
    setIsLoggedIn(true);
    setShowLoginOTP(false);
      
      // Show welcome popup for login
    setWelcomeData({ 
      firstName: data?.user?.firstName || 'User', 
      isSignup: false 
    });
      setShowWelcomePopup(true);
      
      // Auto-hide popup after 4 seconds
      setTimeout(() => {
        setShowWelcomePopup(false);
      }, 4000);
  };

  const handleOTPError = (message: string) => {
    console.log('OTP Error:', message);
    if (showSignupOTP) {
      setSignupError(message);
    } else if (showLoginOTP) {
      setLoginError(message);
    }
  };

  const handleBackToSignup = () => {
    setShowSignupOTP(false);
    setTempSignupData(null);
    setSignupError('');
  };

  const handleBackToLogin = () => {
    setShowLoginOTP(false);
    setLoginError('');
  };

  const handleBackToGoogleLogin = () => {
    setShowGoogleOTP(false);
    setSignupError('');
    setLoginError('');
  };

  const handleGoogleOTPSuccess = (data: any) => {
    console.log('Google OTP success:', data);
    setIsLoggedIn(true);
    setShowGoogleOTP(false);
    
    // Show welcome popup for Google login
    setWelcomeData({ 
      firstName: data?.user?.firstName || 'User', 
      isSignup: false 
    });
    setShowWelcomePopup(true);
    
    // Auto-hide popup after 4 seconds
    setTimeout(() => {
      setShowWelcomePopup(false);
    }, 4000);
  };
  
  // Add the missing handleSignup function
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    setSignupLoading(true);
    
    try {
      // Combine firstName and lastName into a single name field for the backend
      const fullName = `${signupFirstName.trim()} ${signupLastName.trim()}`.trim();
      
      // First step: Send OTP for signup
      const response = await sendSignupOTP({
        email: signupEmail,
        name: fullName,
        password: signupPassword
      });
      
      // Second step: Show OTP verification
      setOtpEmail(signupEmail);
      setTempSignupData({
        password: signupPassword,
        name: fullName,
        firstName: signupFirstName,
        lastName: signupLastName
      } as any);
      setShowSignupOTP(true);
      setSignupError('');
    } catch (error: any) {
      setSignupError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check authentication status on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsLoggedIn(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setShowScrollTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
  };

  // Auto-advance timer for industry slides
  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % industrySlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Section backgrounds
  const [sectionBgs, setSectionBgs] = useState([
    '#fff', // Section 1 (e.g. intro/feature)
    '#fff', // Section 2 (e.g. three ways)
    '#f4ffe9', // Section 3 (e.g. auto-changing grid)
    '#fff', // Section 4 (e.g. integrates)
    '#f4ffe9', // Section 5 (e.g. automated sequence)
    '#fff', // Section 6 (e.g. testimonial/results)
    '#fff', // Section 7 (e.g. more reasons)
    '#f5f5dc', // Section 8 (e.g. bottom CTA)
  ]);
  useEffect(() => {
    const updateBgs = () => {
      if (document.documentElement.classList.contains('dark')) {
        setSectionBgs(Array(sectionBgs.length).fill('#000'));
      } else {
        setSectionBgs([
          '#fff',
          '#fff',
          '#f4ffe9',
          '#fff',
          '#f4ffe9',
          '#fff',
          '#fff',
          '#f5f5dc',
        ]);
      }
    };
    updateBgs();
    const observer = new MutationObserver(updateBgs);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [formBg, setFormBg] = useState('#fff');
  useEffect(() => {
    const updateFormBg = () => {
      if (document.documentElement.classList.contains('dark')) {
        setFormBg('#000');
      } else {
        setFormBg('#fff');
      }
    };
    updateFormBg();
    const observer = new MutationObserver(updateFormBg);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [cardBg, setCardBg] = useState('#fff');
  useEffect(() => {
    const updateCardBg = () => {
      if (document.documentElement.classList.contains('dark')) {
        setCardBg('#111');
      } else {
        setCardBg('#fff');
      }
    };
    updateCardBg();
    const observer = new MutationObserver(updateCardBg);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!mounted) return null

  const features = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "WhatsApp Click-to-Message Ads",
      description: "Create engaging ads that directly open WhatsApp conversations"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Instant Lead Generation",
      description: "Convert clicks into conversations instantly"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Trusted by 10,000+ Businesses",
      description: "Join thousands of successful businesses worldwide"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Customer Engagement",
      description: "Build meaningful relationships with your customers"
    }
  ]

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Marketing Director",
      company: "TechCorp",
      content: "{process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} transformed our lead generation. We saw a 300% increase in qualified leads within the first month.",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Founder",
      company: "StartupXYZ",
      content: "The easiest way to connect with customers. Our conversion rates have never been higher.",
      rating: 5
    }
  ]

  const reasons = [
    {
      icon: ChevronRight,
      title: "Access to Meta's APIs",
      description: "Leverage direct Meta APIs and get access to the latest WhatsApp Business API features"
    },
    {
      icon: TrendingUp,
      title: "Scalable Infrastructure",
      description: "1000s of brands have partnered with us to scale up their customer support & engagement!"
    },
    {
      icon: Files,
      title: "Seamless Integrations",
      description: "OOTB integrations with your favorite CRMs, payment gateways, e-stores & marketing automation platforms"
    },
    {
      icon: CircuitBoard,
      title: "Smooth onboarding & easy setup",
      description: "Minimize operational disruption, and deploy a powerful WhatsApp solution for your business in a few simple steps!"
    },
    {
      icon: BarChart3,
      title: "Highly competitive pricing",
      description: "No hidden costs – transparent pricing structure with no lock-ins. We show you campaign costs upfront so that there are no surprises later."
    },
    {
      icon: Headphones,
      title: "Industry Leading Support",
      description: "Access our premium customer support and get a resolution within minutes!"
    }
  ];

  // Show loading spinner while checking authentication
  if (authLoading) {
  return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Show Dashboard Layout when logged in */}
      {isLoggedIn ? (
        <DashboardLayout />
      ) : (
        <>
          {/* Landing page content when not logged in */}
          {currentSection === 'contacts' && <ContactsSection />}
          {currentSection === 'home' && (
    <div 
      className="min-h-screen transition-colors duration-300 flex flex-col" 
      style={{ 
        minHeight: '100vh',
        backgroundColor: isDark ? '#000000' : '#ffffff',
        color: isDark ? '#ffffff' : '#000000'
      }}
    >
      {/* Add a theme switch button in the top right corner */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-4 right-4 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg backdrop-blur-sm"
        style={{ 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)',
          color: isDark ? '#ffffff' : '#000000'
        }}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 transition-transform duration-300"
            style={{ transform: 'rotate(0deg)' }}
          >
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36-3.54-3.54M20.5 12.5l-3-3M3.5 12.5l3-3" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 transition-transform duration-300"
            style={{ transform: 'rotate(180deg)' }}
          >
            <path d="M12 2v1M12 20v1M4 12H3M20 12h1M16.5 7.5l-3-3M8.5 16.5l-3 3" />
          </svg>
        )}
      </button>
      
      <div className="flex-[0.5] flex flex-col justify-center">
        <HeroSection />
      </div>
      <div className="flex-[0.5]">
        <FeatureBar />
      </div>
      {/* New Section: Click-to-WhatsApp Ads, after FeatureBar */}
      <section
        className="w-full py-16 px-4 flex items-center justify-center transition-colors duration-300"
        style={{ 
          backgroundColor: isDark ? '#0a0a0a' : '#F1FEED',
          color: isDark ? '#ffffff' : '#23291f'
        }}
      >
        <div className="max-w-7xl w-full flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16">
          {/* Left: Heading and Points */}
          <div className="flex-1 flex flex-col items-start justify-center">
            <h2 
              className="text-4xl sm:text-5xl font-bold mb-6 transition-colors duration-300" 
              style={{ 
                color: isDark ? '#ffffff' : '#23291f', 
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif', 
                letterSpacing: '-0.02em' 
              }}
            >
              Boost your Business with <span style={{ color: '#3ed17b' }}>Click-to-WhatsApp</span> Ads
            </h2>
            <ul className="space-y-7 w-full mt-2">
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#3ed17b] bg-opacity-20">
                  <svg width="28" height="28" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2l4-4"/><circle cx="14" cy="14" r="12"/></svg>
                </span>
                <span 
                  className="text-xl font-bold transition-colors duration-300" 
                  style={{ color: isDark ? '#ffffff' : '#23291f' }}
                >
                  Increase revenue with automated chats.
                </span>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#3ed17b] bg-opacity-20">
                  <svg width="28" height="28" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="14" cy="14" r="12"/><path d="M14 18v-5"/><path d="M14 10h.01"/></svg>
                </span>
                <span 
                  className="text-xl font-bold transition-colors duration-300" 
                  style={{ color: isDark ? '#ffffff' : '#23291f' }}
                >
                  Pinpoint the right subscribers with segmentation.
                </span>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#3ed17b] bg-opacity-20">
                  <svg width="28" height="28" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="20" height="20" rx="3"/><path d="M10 10h8v8h-8z"/></svg>
                </span>
                <span 
                  className="text-xl font-bold transition-colors duration-300" 
                  style={{ color: isDark ? '#ffffff' : '#23291f' }}
                >
                  Easily add product to your cart.
                </span>
              </li>
            </ul>
          </div>
          {/* Right: WhatsApp Business Mockup Image */}
          <div className="flex-1 flex items-center justify-center">
            <img
              src="/whatsapp-business-mockup.png"
              alt="WhatsApp Business Mockup"
              className="w-full max-w-md md:max-w-md lg:max-w-lg rounded-2xl shadow-xl border transition-all duration-300"
              style={{ 
                background: isDark ? '#1a1a1a' : '#e0f7d9',
                borderColor: isDark ? '#333333' : '#e0f7d9'
              }}
            />
          </div>
        </div>
      </section>

      {/* Three Ways to Get Started Section */}
      <section 
        className="w-full py-16 px-4 transition-colors duration-300" 
        style={{ 
          backgroundColor: isDark ? '#000000' : sectionBgs[1],
          color: isDark ? '#ffffff' : '#000000'
        }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 transition-colors duration-300">
              <span style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Three ways to get started with your{' '}
              </span>
              <span className="text-[#13C18D]">business.</span>
            </h2>
          </div>

          {/* Three Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Card 1 - Monthly Payment */}
            <div 
              className="rounded-xl p-6 md:p-8 flex flex-col items-center text-center transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: isDark ? '#1a1a1a' : cardBg,
                border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
              }}
            >
              <div 
                className="w-16 h-16 rounded-lg flex items-center justify-center mb-6 transition-colors duration-300"
                style={{ backgroundColor: isDark ? '#333333' : '#f3f4f6' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <h3 
                className="text-xl font-bold mb-4 transition-colors duration-300"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Monthly payment options available
              </h3>
              <p 
                className="mb-6 flex-1 transition-colors duration-300"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                No matter how you like to buy, we have an option that works for you.
              </p>
              <button 
                className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105"
                style={{ 
                  backgroundColor: isDark ? '#CCFF00' : '#000000',
                  color: isDark ? '#000000' : '#ffffff'
                }}
              >
                Explore
              </button>
            </div>

            {/* Card 2 - Save Time */}
            <div 
              className="rounded-xl p-6 md:p-8 flex flex-col items-center text-center transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: isDark ? '#1a1a1a' : cardBg,
                border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
              }}
            >
              <div 
                className="w-16 h-16 rounded-lg flex items-center justify-center mb-6 transition-colors duration-300"
                style={{ backgroundColor: isDark ? '#333333' : '#f3f4f6' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </div>
              <h3 
                className="text-xl font-bold mb-4 transition-colors duration-300"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Save your time with {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}
              </h3>
              <p 
                className="mb-6 flex-1 transition-colors duration-300"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                From getting an estimate to returning device, we'll help every step of the way.
              </p>
              <button 
                className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105"
                style={{ 
                  backgroundColor: isDark ? '#CCFF00' : '#000000',
                  color: isDark ? '#000000' : '#ffffff'
                }}
              >
                Explore
              </button>
            </div>

            {/* Card 3 - Shop with Specialist */}
            <div 
              className="rounded-xl p-6 md:p-8 flex flex-col items-center text-center transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: isDark ? '#1a1a1a' : cardBg,
                border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
              }}
            >
              <div 
                className="w-16 h-16 rounded-lg flex items-center justify-center mb-6 transition-colors duration-300"
                style={{ backgroundColor: isDark ? '#333333' : '#f3f4f6' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h3 
                className="text-xl font-bold mb-4 transition-colors duration-300"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Shop one on one with a Specialist online.
              </h3>
              <p 
                className="mb-6 flex-1 transition-colors duration-300"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                Get help finding what's right for you. Reserve a shopping session with us.
              </p>
              <button 
                className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105"
                style={{ 
                  backgroundColor: isDark ? '#CCFF00' : '#000000',
                  color: isDark ? '#000000' : '#ffffff'
                }}
              >
                Explore
              </button>
            </div>
          </div>
        </div>
      </section>

      
      {/* Built for any Industry Section */}
      <section 
        className="w-full py-16 px-4 flex items-center justify-center"
        style={{ backgroundColor: sectionBgs[2] }}
      >
        <div className="max-w-7xl w-full flex flex-col items-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-center px-4" style={{ color: '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
            Built for any <span style={{ color: '#3ed17b' }}>Industry</span>
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-center max-w-2xl px-4 mb-8 sm:mb-12" style={{ color: '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            Discover how {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} transforms businesses across diverse industries with tailored WhatsApp solutions
          </p>
        
        {/* Auto-changing Grid Layout */}
        <div className="w-full max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            {industrySlides[slide].map((card, idx) => (
              <motion.div
                key={`${card.title}-${slide}-${idx}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.7, delay: idx * 0.12 }}
                whileHover={{ rotate: 2, scale: 1.045 }}
                className="relative"
              >
                <Card
                  className="group relative overflow-hidden border-0 shadow-2xl transition-all duration-500 rounded-3xl px-0 pt-0 pb-2"
                  style={{
                    background: isDark ? '#18181b' : 'rgba(255,255,255,0.90)',
                    color: isDark ? '#f3f4f6' : '#23291f',
                    boxShadow: isDark
                      ? '0 8px 32px 0 rgba(62, 209, 123, 0.10), 0 1.5px 8px 0 rgba(62, 209, 123, 0.05), 0 0 0 1px #232323 inset'
                      : '0 8px 32px 0 rgba(62, 209, 123, 0.10), 0 1.5px 8px 0 rgba(62, 209, 123, 0.05)',
                    border: isDark ? '1px solid #232323' : undefined
                  }}
                >
                  {/* Floating badge/icon */}
                  <div className="absolute top-4 right-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#3ed17b] to-[#2bb673] shadow-lg ring-2 ring-white/60 dark:ring-gray-900/60 animate-pulse">
                    <Sparkles className="w-5 h-5 text-white drop-shadow" />
                  </div>
                  <CardHeader className="relative z-10 p-0">
                    <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden rounded-t-3xl">
                      <img
                        src={card.img}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        style={{ filter: isDark ? 'brightness(0.8) contrast(1.1)' : 'none' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                    <CardTitle className="text-xl md:text-2xl font-extrabold mt-6 group-hover:text-[#3ed17b] transition-colors duration-300 text-center tracking-tight"
                      style={{ color: isDark ? '#f3f4f6' : '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 p-6 pt-3 flex flex-col gap-3">
                    <ul className="space-y-3">
                      {card.points.map((point, i) => (
                        <li key={i} className="flex items-start gap-3 group-hover:text-[#23291f] transition-colors duration-300"
                          style={{ color: isDark ? '#e5e7eb' : '#23291f' }}>
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3ed17b] mt-2 flex-shrink-0 shadow-md"></span>
                          <span className="text-base leading-relaxed font-medium" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Slide indicators */}
        <div className="flex gap-2 sm:gap-3 mt-6 sm:mt-8 justify-center">
          {industrySlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSlide(idx)}
              className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full transition-all duration-300 ${
                slide === idx ? 'bg-[#3ed17b] scale-125' : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
        </div>
      </section>
      {/* Integrates easily with 60+ platforms Section */}
      <section className="w-full bg-white dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center border-t border-gray-100 dark:border-gray-800" style={{ backgroundColor: sectionBgs[3] }}>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 sm:mb-8 md:mb-10 text-black dark:text-white px-4">
          Integrates easily with <span className="text-[#13C18D]">60+</span> platforms
        </h2>
        <div className="flex flex-row justify-center items-center gap-x-6 sm:gap-x-8 md:gap-x-12 mb-8 sm:mb-10 md:mb-12 w-full max-w-5xl overflow-x-auto scrollbar-hide px-2 sm:px-4">
          {/* Platform logos from reliable online sources */}
          <img src="https://cdn.worldvectorlogo.com/logos/facebook-3.svg" alt="Facebook Ads" className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
          <img src="https://cdn.worldvectorlogo.com/logos/google-sheets-1.svg" alt="Google Sheets" className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
          <img src="https://cdn.worldvectorlogo.com/logos/woocommerce.svg" alt="WooCommerce" className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
          <img src="https://cdn.worldvectorlogo.com/logos/shopify.svg" alt="Shopify" className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
          <img src="https://cdn.worldvectorlogo.com/logos/zoho.svg" alt="Zoho CRM" className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
          <img src="https://cdn.worldvectorlogo.com/logos/pabbly.svg" alt="Pabbly" className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
        </div>
        <button 
          onClick={() => router.push('/auth/register')}
          className={`font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base md:text-lg shadow-lg transition-all duration-500 transform ${
            activeButton === 'platforms'
              ? 'bg-[#CCFF00] text-black scale-105 shadow-2xl'
              : 'bg-[#CCFF00] text-black hover:bg-[#BFFF00] hover:shadow-2xl hover:scale-110 hover:-translate-y-1'
          }`}
        >
          Get Started With Free Trial
        </button>
      </section>
      {/* New Section: Same color and font as hero, below integrates section */}
      <section
        className="w-full py-16 px-4 flex items-center justify-center"
        style={{ backgroundColor: sectionBgs[4] }}
      >
        <div className="max-w-7xl w-full flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16">
          {/* Left: Text and Points */}
          <div className="flex-1 flex flex-col items-start justify-center">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
              Create and send an <span style={{ color: '#3ed17b' }}>automated</span> sequence of WhatsApp messages
            </h2>
            <p className="text-lg sm:text-xl mt-2 mb-8" style={{ color: '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              Transcend beyond the realm of standard templates and leave a lasting impression on your customers and prospects with the power of AI-assisted personalization.
            </p>
            <ul className="space-y-6 w-full">
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3ed17b] bg-opacity-20">
                  <svg width="24" height="24" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2l4-4"/><circle cx="12" cy="12" r="10"/></svg>
                </span>
                <span className="text-lg font-semibold" style={{ color: '#23291f' }}>Increase your customer engagement in a jiffy by automating!</span>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3ed17b] bg-opacity-20">
                  <svg width="24" height="24" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </span>
                <span className="text-lg font-semibold" style={{ color: '#23291f' }}>Sending a series of messages to your prospects</span>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3ed17b] bg-opacity-20">
                  <svg width="24" height="24" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
                </span>
                <span className="text-lg font-semibold" style={{ color: '#23291f' }}>Use cases for sequence page</span>
              </li>
            </ul>
          </div>
          {/* Right: WhatsApp Mockup Image */}
          <div className="flex-1 flex items-center justify-center">
            <img
              src="/whatsapp-mockup.png"
              alt="WhatsApp Mockup"
              className="w-full max-w-xl rounded-2xl shadow-xl border border-[#e0f7d9]"
              style={{ background: '#e0f7d9' }}
            />
          </div>
        </div>
      </section>
      {/* Testimonial/Results Section */}
      <section className="w-full bg-white dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center" style={{ backgroundColor: sectionBgs[5] }}>
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 sm:gap-10 md:gap-12 px-4 sm:px-6">
          {/* Left: Quote with comma behind text */}
          <div className="flex-1 flex flex-col justify-center items-start relative">
            <svg width="120" height="120" viewBox="0 0 48 48" fill="none" className="absolute -top-6 -left-6 md:-top-8 md:-left-8 opacity-20 z-0" style={{color:'#13C18D', transform: 'rotate(-15deg)'}} xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 8C10.6 8 6 13.6 6 21.5c0 5.5 3.4 10.3 8.8 11.7V40c0 2 1.3 3.5 3.5 3.5s3.5-1.5 3.5-3.5V21.5C21.8 13.6 17.5 8 17.5 8z" fill="currentColor"/>
            </svg>
            <div className="relative z-10">
              <p className="text-2xl md:text-3xl font-medium italic text-gray-800 dark:text-white leading-snug">
                We were able to increase our revenue from the first Diwali to the second Diwali to approximately 4× of what we did and we couldn't have done this without the help of {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}.
              </p>
              <div className="mt-4">
                <span className="text-[#13C18D] font-bold text-4xl">Yash Banage</span><br />
                <span className="text-2xl font-bold text-gray-800 dark:text-white">Co-founder, Bombay Sweet Shop</span>
              </div>
            </div>
          </div>
          {/* Right: Image with no background */}
          <div className="flex-1 flex justify-center items-center">
            <img src="/sweet.webp" alt="Bombay Sweet Shop" className="object-contain w-[420px] h-[420px] md:w-[520px] md:h-[520px] rounded-2xl" />
          </div>
        </div>
        {/* Stats Cards */}
        <div className="w-full max-w-5xl mt-4 sm:mt-6 flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 justify-center items-center px-4">
          <div className="flex-1 min-w-[250px] sm:min-w-[300px] h-[140px] sm:h-[170px] bg-white border-2 border-[#ffe6b3] rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center text-center shadow-sm justify-center" style={{ backgroundColor: cardBg }}>
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0e3c2c] mb-2">1.56L</span>
            <span className="text-sm sm:text-base md:text-xl text-gray-700 text-center">revenue generated in a day</span>
          </div>
          <div className="flex-1 min-w-[250px] sm:min-w-[300px] h-[140px] sm:h-[170px] bg-white border-2 border-[#ffe6b3] rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center text-center shadow-sm justify-center" style={{ backgroundColor: cardBg }}>
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0e3c2c] mb-2">40%</span>
            <span className="text-sm sm:text-base md:text-xl text-gray-700 text-center">customer queries handled by Boondi – the bot</span>
          </div>
          <div className="flex-1 min-w-[250px] sm:min-w-[300px] h-[140px] sm:h-[170px] bg-white border-2 border-[#ffe6b3] rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center text-center shadow-sm justify-center" style={{ backgroundColor: cardBg }}>
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0e3c2c] mb-2">4X</span>
            <span className="text-sm sm:text-base md:text-xl text-gray-700 text-center">increase in revenue since onboarding with {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}</span>
          </div>
        </div>
      </section>
      {/* More reasons to choose Interakt Section */}
      <section className="w-full bg-white dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center relative overflow-hidden" style={{ backgroundColor: sectionBgs[6] }}>
        {/* Floating background elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-[#13C18D]/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-gradient-to-br from-[#CCFF00]/15 to-transparent rounded-full blur-3xl animate-bounce" style={{animationDuration: '4s'}}></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-br from-[#13C18D]/8 to-[#CCFF00]/5 rounded-full blur-2xl animate-pulse" style={{animationDuration: '3s'}}></div>
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-gradient-to-br from-[#CCFF00]/10 to-[#13C18D]/8 rounded-full blur-2xl animate-bounce" style={{animationDuration: '3.5s', animationDelay: '1s'}}></div>
        
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-2 sm:mb-3 text-gray-900 dark:text-white px-4 relative z-10" style={{fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em'}}>More reasons to <span className="text-[#13C18D]">choose</span> {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}</h2>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-white mb-8 sm:mb-10 md:mb-12 font-medium tracking-wide px-4 relative z-10" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>Why businesses love us</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 w-full max-w-6xl px-4 sm:px-6 md:px-0 relative z-10">
          {reasons.map((reason, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="group relative rounded-3xl p-4 sm:p-5 md:p-6 lg:p-7 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/60 dark:border-gray-700/60 shadow-2xl hover:shadow-3xl transition-all duration-700 flex flex-col items-center hover:-translate-y-3 hover:scale-105 overflow-hidden"
              style={{ minHeight: '160px', backgroundColor: cardBg }}
            >
              {/* Modern gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              
              {/* Floating decorative elements */}
              <div className="absolute top-2 right-2 w-20 h-20 bg-gradient-to-br from-[#13C18D]/20 to-[#CCFF00]/15 rounded-full -translate-y-10 translate-x-10 group-hover:scale-150 transition-transform duration-700 animate-pulse"></div>
              <div className="absolute bottom-2 left-2 w-16 h-16 bg-gradient-to-br from-[#CCFF00]/15 to-[#13C18D]/20 rounded-full translate-y-8 -translate-x-8 group-hover:scale-150 transition-transform duration-700 animate-bounce" style={{animationDuration: '3s'}}></div>
              <div className="absolute top-1/2 left-4 w-12 h-12 bg-gradient-to-br from-[#13C18D]/10 to-[#CCFF00]/8 rounded-full animate-pulse" style={{animationDuration: '2.5s'}}></div>
              <div className="absolute top-1/3 right-4 w-10 h-10 bg-gradient-to-br from-[#CCFF00]/12 to-[#13C18D]/10 rounded-full animate-bounce" style={{animationDuration: '3.5s', animationDelay: '0.8s'}}></div>
              
              {/* Modern icon container with glow */}
              <div className="relative z-10 mb-3 sm:mb-4 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#13C18D]/20 via-[#13C18D]/15 to-[#13C18D]/10 shadow-2xl group-hover:shadow-3xl transition-all duration-500 group-hover:scale-110 border border-[#13C18D]/20">
                <reason.icon className="w-6 h-6 sm:w-7 sm:h-7 text-[#13C18D] group-hover:text-[#0e8c6c] transition-colors duration-300 drop-shadow-sm" />
              </div>
              
              {/* Content with enhanced typography */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4 text-center leading-tight" style={{fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif'}}> 
                  {reason.title} 
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center leading-relaxed max-w-[200px] sm:max-w-[220px] font-medium" style={{fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif'}}>
                  {reason.description}
                </p>
              </div>
              
              {/* Modern bottom accent with gradient */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#13C18D] via-[#CCFF00] to-[#13C18D] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-b-3xl"></div>
              
              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#13C18D]/0 via-[#13C18D]/5 to-[#13C18D]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </motion.div>
          ))}
        </div>
      </section>
      
      {/* Bottom CTA Section */}
      <section className="w-full bg-[#f5f5dc] dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center" style={{ backgroundColor: sectionBgs[7] }}>
        <div className="text-center max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em'}}>
            Ready to <span className="text-[#13C18D]">Transform</span> Your Business?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-white mb-6 sm:mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} to grow their customer engagement and drive conversions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button 
              onClick={() => {
                setActiveButton('bottom');
                document.getElementById('signup-form')?.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'center'
                });
                setTimeout(() => setActiveButton(null), 1000);
              }}
              className={`font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base md:text-lg shadow-lg transition-all duration-500 transform ${
                activeButton === 'bottom'
                  ? 'bg-[#CCFF00] text-black scale-105 shadow-2xl'
                  : 'bg-[#CCFF00] text-black hover:bg-[#BFFF00] hover:shadow-2xl hover:scale-110 hover:-translate-y-1'
              }`}
            >
              Get Started With Free Trial
            </button>
            <Link
              href="/privacy"
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base md:text-lg font-semibold border border-gray-300 text-gray-800 dark:text-white bg-white/80 dark:bg-gray-900/60 hover:border-gray-400 hover:shadow-md transition-all duration-300"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </section>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-4 sm:bottom-6 md:bottom-8 right-4 sm:right-6 md:right-8 z-50 w-10 h-10 sm:w-12 sm:h-12 bg-[#CCFF00] hover:bg-[#BFFF00] text-black rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
        </motion.button>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-[#f5f5dc] dark:bg-black py-4 text-center text-gray-700 dark:text-white text-sm font-medium" style={{fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif'}}>
        @2025 {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}. All rights reserved.
      </footer>
    </div>
          )}
        </>
      )}

      {/* Welcome Popup */}
      {showWelcomePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md mx-4 transform transition-all duration-300 scale-100">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              {/* Welcome Message */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome{!welcomeData.isSignup ? ' back' : ''}, {welcomeData.firstName}! 🎉
              </h2>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {welcomeData.isSignup 
                  ? "Your account has been created successfully. You're now ready to manage your WhatsApp business communications!"
                  : "You've been logged in successfully. Welcome back to your dashboard!"
                }
              </p>
              
              {/* Action Button */}
              <button
                onClick={() => router.push('/auth/register')}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}