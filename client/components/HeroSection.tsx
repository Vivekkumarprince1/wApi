"use client"

import Image from "next/image"
import { CheckCircle, Smartphone, Users, Settings, BarChart2, Shield, MessageCircle, Sparkles } from "lucide-react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

export default function HeroSection() {
  const router = useRouter()
  // Typewriter effect for animated word
  const words = [
    { text: "leads", color: "#10b981" }, // green
    { text: "customers", color: "#3b82f6" }, // blue
    { text: "revenue", color: "#8b5cf6" }, // purple
    { text: "sales", color: "#ec4899" }, // pink
  ];
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);
  const [isButtonActive, setIsButtonActive] = useState(false);
  const [heroBg, setHeroBg] = useState('#F1FEED');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentWord = words[wordIndex].text;
    if (typing) {
      if (displayed.length < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayed(currentWord.slice(0, displayed.length + 1));
        }, 80);
      } else {
        timeout = setTimeout(() => setTyping(false), 800);
      }
    } else {
      timeout = setTimeout(() => {
        setTyping(true);
        setDisplayed("");
        setWordIndex((prev) => (prev + 1) % words.length);
      }, 600);
    }
    return () => clearTimeout(timeout);
  }, [displayed, typing, wordIndex]);

  useEffect(() => {
    const updateBg = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
      if (isDarkMode) {
        setHeroBg('#000');
      } else {
        setHeroBg('#F1FEED');
      }
    };
    updateBg();
    const observer = new MutationObserver(updateBg);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full min-h-[90vh] flex flex-col justify-center overflow-hidden transition-colors duration-300" style={{ backgroundColor: heroBg }}>

      {/* Top Banner with Promotion */}
      <div className="w-full bg-gradient-to-r from-[#10b981] via-[#059669] to-[#10b981] text-white text-center py-3 font-bold text-sm sm:text-base tracking-wide shadow-lg relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          <span>Limited Time Offer: Get Started @₹799/month (Annual plans only) 🚀</span>
          <Sparkles className="w-5 h-5" />
        </motion.div>
      </div>

      {/* Navigation Header */}
      <div className="flex items-center justify-between py-4 px-6 md:px-12 relative z-10 max-w-7xl mx-auto w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-xl flex items-center justify-center shadow-lg">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] bg-clip-text text-transparent">
            {process.env.NEXT_PUBLIC_APP_NAME || 'WABA'}
          </h1>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/auth/login')}
            className="hidden sm:block px-6 py-2 text-sm font-semibold rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: isDark ? '#ffffff' : '#000000' }}
          >
            Login
          </button>
          <button
            onClick={() => router.push('/auth/register')}
            className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            Get Started Free
          </button>
        </div>
      </div>

      {/* Hero Main Section */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 relative z-10">
        {/* Central Content */}
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          {/* Meta Business Partner Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-md">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Official Meta Business Partner</span>
            </div>
          </motion.div>

          {/* Main Headline with Animation */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight"
            style={{
              color: isDark ? '#ffffff' : '#1a202c',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}
          >
            Turn WhatsApp into your
            <br />
            <span className="relative inline-block mt-2">
              <span style={{ color: words[wordIndex].color }}>
                {displayed}
                <motion.span
                  className="inline-block w-[3px] h-12 sm:h-14 md:h-16 align-middle ml-1 bg-current"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </span>
            </span>
            {' '}engine
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg sm:text-xl md:text-2xl mb-8 max-w-3xl leading-relaxed"
            style={{
              color: isDark ? '#d1d5db' : '#4a5568',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            The complete WhatsApp Business Platform to engage customers, generate leads, and drive sales — all on WhatsApp.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-8"
          >
            <button
              onClick={() => router.push('/auth/register')}
              className="px-8 py-4 text-lg font-bold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white rounded-xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 hover:-translate-y-1"
            >
              Start Free Trial →
            </button>
            <button
              onClick={() => router.push('#demo')}
              className="px-8 py-4 text-lg font-bold bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-gray-200 dark:border-gray-700"
            >
              Watch Demo
            </button>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Cancel anytime</span>
            </div>
          </motion.div>
        </div>

        {/* Hero Image/Illustration */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="relative mt-12 w-full max-w-6xl"
        >
          <div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] flex items-center justify-center">
            <Image
              src="/girl.png"
              alt="WhatsApp Business Platform"
              fill
              className="object-contain rounded-2xl"
              style={{
                filter: isDark ? 'brightness(0.9) contrast(1.1)' : 'brightness(1.05)',
                mixBlendMode: isDark ? 'lighten' : 'normal'
              }}
              priority
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center text-center min-w-[120px] max-w-[180px] mx-auto">
      <div className="mb-2">{icon}</div>
      <div className="text-xs md:text-sm font-medium text-gray-700">{text}</div>
    </div>
  )
} 