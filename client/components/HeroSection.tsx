  "use client"

import Image from "next/image"
import { CheckCircle, Smartphone, Users, Settings, BarChart2, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

export default function HeroSection() {
  const router = useRouter()
  // Typewriter effect for animated word
  const words = [
    { text: "leads", color: "#ef4444" }, // red
    { text: "customers", color: "#f97316" }, // orange
    { text: "marketing", color: "#22c55e" }, // green
    { text: "sales", color: "#3b82f6" }, // blue
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
    <div className="relative w-full min-h-[80vh] flex flex-col justify-center overflow-hidden transition-colors duration-300" style={{ backgroundColor: heroBg, minHeight: '80vh' }}>
      
      {/* Top Banner */}
      <div className="w-full bg-gradient-to-r from-[#FFB62E] via-[#FFC94D] to-[#FFB62E] text-black text-center py-1 font-bold text-xs sm:text-sm md:text-base lg:text-xl tracking-wide shadow-lg relative z-10">
        Get Started @799/month [Annual plans only] 🚀
      </div>

      {/* Inkerakt Logo and Company Name */}
      <div className="flex items-center justify-center py-4 px-4 relative z-10">
        <div className="flex items-center gap-3">
          {/* Inkerakt Logo */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-lg flex items-center justify-center shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="sm:w-6 sm:h-6">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {/* Company Name */}
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] bg-clip-text text-transparent">
            Inkerakt
          </h1>
        </div>
      </div>

      {/* Hero Main Section */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full px-4 sm:px-6 h-full relative z-10">
        {/* Central Content */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 transition-colors duration-300" 
            style={{ 
              color: '#23291f', // Keep same color in both themes
              fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif' 
            }}
          >
            Turn your WhatsApp conversations into{' '}
            <span style={{ color: words[wordIndex].color }}>
              {displayed}
              <motion.span 
                className="inline-block w-[2px] h-8 sm:h-10 md:h-12 align-middle ml-1 bg-current" 
                style={{ borderRadius: '1px' }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </span>
          </motion.h1>
          
          {/* Sub-headline */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg sm:text-xl md:text-2xl mb-8 max-w-2xl transition-colors duration-300" 
            style={{ 
              color: '#23291f', // Keep same color in both themes
              fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif' 
            }}
          >
            Integrate effortlessly with the WhatsApp Business API. The only full-stack platform to offer a seamless customer experience & grow your business on WhatsApp.
          </motion.p>
          
          {/* Meta Business Partner Logo */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-md">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#1877F2"/>
                <path d="M2 17L12 22L22 17" fill="#1877F2"/>
                <path d="M2 12L12 17L22 12" fill="#1877F2"/>
              </svg>
              <span className="text-sm font-semibold text-gray-700">Meta Business Partner</span>
            </div>
          </motion.div>
          
          {/* CTA Button - Updated for dark theme */}
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            onClick={() => router.push('/auth/register')}
            className={`mt-2 sm:mt-3 font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base shadow-2xl transition-all duration-500 transform ${
              isButtonActive 
                ? 'scale-105 shadow-3xl' 
                : 'hover:shadow-3xl hover:scale-110 hover:-translate-y-1'
            }`}
            style={{
              fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif', 
              fontWeight: 700, 
              letterSpacing: '0.02em', 
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
              backgroundColor: isDark ? '#CCFF00' : '#CCFF00',
              color: isDark ? '#000000' : '#000000'
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Start Free Trial
          </motion.button>
        </div>
        
        {/* Central Woman with Phone */}
        <div className="relative mt-8 mb-4">
          <div className="relative w-[1000px] h-[250px] sm:w-[1200px] sm:h-[300px] md:w-[1400px] md:h-[350px] lg:w-[1600px] lg:h-[400px] flex items-center justify-center">
            <Image
              src="/girl.png"
              alt="Woman with phone"
              fill
              className="object-contain rounded-xl transition-all duration-300"
              style={{ 
                filter: isDark ? 'brightness(0.8) contrast(1.1)' : 'none'
              }}
              priority
            />
          </div>
        </div>
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