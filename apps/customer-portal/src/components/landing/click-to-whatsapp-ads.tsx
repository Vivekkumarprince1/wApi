"use client";

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function ClickToWhatsAppAds({ isDark }: { isDark: boolean }) {
  const router = useRouter();

  const features = [
    {
      title: 'Automate Sales Conversations',
      desc: 'Turn ad clicks into automated WhatsApp conversations that drive revenue 24/7',
      svg: (
        <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    },
    {
      title: 'Target & Segment Precisely',
      desc: 'Reach the right customers with advanced audience segmentation and targeting',
      svg: (
        <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      title: 'Drive Instant Purchases',
      desc: 'Enable one-tap product catalog browsing and checkout directly in WhatsApp',
      svg: (
        <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      )
    }
  ];

  return (
    <section
      className="w-full py-20 px-4 flex items-center justify-center transition-colors duration-300"
      style={{
        backgroundColor: isDark ? '#0f0f0f' : '#f8faf9',
        color: isDark ? '#ffffff' : '#23291f'
      }}
    >
      <div className="max-w-7xl w-full flex flex-col md:flex-row items-center justify-between gap-12 md:gap-20">
        <div className="flex-1 flex flex-col items-start justify-center">
          <motion.h2
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 leading-tight"
            style={{
              color: isDark ? '#ffffff' : '#1a202c',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.03em'
            }}
          >
            Launch Powerful <span className="text-primary">Click-to-WhatsApp</span> Ad Campaigns
          </motion.h2>
          <ul className="space-y-6 w-full">
            {features.map((feature, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * (idx + 1) }}
                className="flex items-start gap-4 group"
              >
                <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-premium group-hover:scale-110 transition-all duration-300">
                  {feature.svg}
                </span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#1a202c' }}>
                    {feature.title}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            onClick={() => router.push('/auth/register')}
            className="mt-8 px-8 py-4 text-lg font-bold bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl shadow-premium hover:shadow-2xl transition-all transform hover:scale-105"
          >
            Start Creating Ads →
          </motion.button>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex-1 flex items-center justify-center relative"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/80/20 blur-3xl"></div>
            <img
              src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=800&fit=crop"
              alt="WhatsApp Business Ads"
              className="relative w-full max-w-sm md:max-w-md max-h-[450px] object-cover rounded-3xl shadow-2xl transition-all duration-300 hover:scale-105"
              style={{
                background: isDark ? '#1a1a1a' : '#ffffff',
                border: isDark ? '1px solid #333' : '1px solid #e5e7eb'
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
