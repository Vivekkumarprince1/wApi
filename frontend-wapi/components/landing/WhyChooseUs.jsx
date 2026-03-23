"use client";

import { motion } from 'framer-motion';
import { ChevronRight, TrendingUp, Files, CircuitBoard, BarChart3, Headphones } from 'lucide-react';

export default function WhyChooseUs({ isDark }) {
  const cardBg = isDark ? '#111' : '#fff';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Interakt';

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

  return (
    <section className="w-full bg-white dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center relative overflow-hidden" style={{ backgroundColor: isDark ? '#000' : '#fff' }}>
      <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-gradient-to-br from-[#CCFF00]/15 to-transparent rounded-full blur-3xl animate-bounce" style={{ animationDuration: '4s' }}></div>
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-br from-primary/8 to-[#CCFF00]/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '3s' }}></div>
      <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-gradient-to-br from-[#CCFF00]/10 to-primary/8 rounded-full blur-2xl animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }}></div>

      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-2 sm:mb-3 text-foreground px-4 relative z-10" style={{ fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>More reasons to <span className="text-primary">choose</span> {appName}</h2>
      <p className="text-sm sm:text-base md:text-lg text-muted-foreground dark:text-foreground mb-8 sm:mb-10 md:mb-12 font-medium tracking-wide px-4 relative z-10" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Why businesses love us</p>
      
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
            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

            <div className="absolute top-2 right-2 w-20 h-20 bg-gradient-to-br from-primary/20 to-[#CCFF00]/15 rounded-full -translate-y-10 translate-x-10 group-hover:scale-150 transition-transform duration-700 animate-pulse"></div>
            <div className="absolute bottom-2 left-2 w-16 h-16 bg-gradient-to-br from-[#CCFF00]/15 to-primary/20 rounded-full translate-y-8 -translate-x-8 group-hover:scale-150 transition-transform duration-700 animate-bounce" style={{ animationDuration: '3s' }}></div>
            <div className="absolute top-1/2 left-4 w-12 h-12 bg-gradient-to-br from-primary/10 to-[#CCFF00]/8 rounded-full animate-pulse" style={{ animationDuration: '2.5s' }}></div>
            <div className="absolute top-1/3 right-4 w-10 h-10 bg-gradient-to-br from-[#CCFF00]/12 to-primary/10 rounded-full animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.8s' }}></div>

            <div className="relative z-10 mb-3 sm:mb-4 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-2xl group-hover:shadow-3xl transition-all duration-500 group-hover:scale-110 border border-primary/20">
              <reason.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary group-hover:text-primary/80 transition-colors duration-300 drop-shadow-sm" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground mb-2 sm:mb-3 md:mb-4 text-center leading-tight" style={{ fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif' }}>
                {reason.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground text-center leading-relaxed max-w-[200px] sm:max-w-[220px] font-medium" style={{ fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif' }}>
                {reason.description}
              </p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-[#CCFF00] to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-b-3xl"></div>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
