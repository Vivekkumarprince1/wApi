"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const industrySlides = [
  [
    {
      img: 'https://images.unsplash.com/photo-1537903904737-13fc2b9e24a5?w=600&h=400&fit=crop',
      bg: 'bg-gradient-to-b from-green-25 to-green-50',
      title: 'Travel & Tourism',
      points: [
        'Automated booking confirmations',
        'Personalized travel offers',
        '24/7 customer support',
      ],
    },
    {
      img: 'https://images.unsplash.com/photo-1599239916253-e2cd7ccf7556?w=600&h=400&fit=crop',
      bg: 'bg-gradient-to-b from-orange-25 to-orange-50',
      title: 'Education',
      points: [
        'Course updates & reminders',
        'Student engagement',
        'Fee payment notifications',
      ],
    },
    {
      img: 'https://images.unsplash.com/photo-1552693520-7b9b4b0d1d92?w=600&h=400&fit=crop',
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
      img: 'https://images.unsplash.com/photo-1460925895917-adf4e565e6b1?w=600&h=400&fit=crop',
      bg: 'bg-gradient-to-b from-green-25 to-green-50',
      title: 'E-commerce',
      points: [
        'Order updates',
        'Abandoned cart recovery',
        'Customer support',
      ],
    },
    {
      img: 'https://images.unsplash.com/photo-1579621970563-430f63602022?w=600&h=400&fit=crop',
      bg: 'bg-gradient-to-b from-orange-25 to-orange-50',
      title: 'Banking & Finance',
      points: [
        'Transaction alerts',
        'Loan reminders',
        'Customer onboarding',
      ],
    },
    {
      img: 'https://images.unsplash.com/photo-1555939594-58d7cb561404?w=600&h=400&fit=crop',
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

export default function IndustrySolutions({ isDark }: { isDark: boolean }) {
  const [slide, setSlide] = useState(0);
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'wApi';

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % industrySlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      className="w-full py-16 px-4 flex items-center justify-center"
      style={{ backgroundColor: isDark ? '#000' : '#f4ffe9' }}
    >
      <div className="max-w-7xl w-full flex flex-col items-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl sm:text-5xl font-bold mb-6 text-center px-4" 
          style={{ color: isDark ? '#fff' : '#23291f', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
        >
          Built for any <span style={{ color: '#3ed17b' }}>Industry</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg sm:text-xl md:text-2xl text-center max-w-2xl px-4 mb-8 sm:mb-12" 
          style={{ color: isDark ? '#ccc' : '#23291f', fontFamily: 'var(--font-sans)' }}
        >
          Discover how {appName} transforms businesses across diverse industries with tailored WhatsApp solutions
        </motion.p>

        <div className="w-full max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            {industrySlides[slide].map((card, idx) => (
              <motion.div
                key={`${card.title}-${slide}-${idx}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
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
                    border: isDark ? '1px solid #232323' : '1px solid #e5e7eb'
                  }}
                >
                  <div className="absolute top-4 right-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#3ed17b] to-[#2bb673] shadow-premium ring-2 ring-white/60 dark:ring-gray-900/60 transition-transform duration-300">
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
                      style={{ color: isDark ? '#f3f4f6' : '#23291f', fontFamily: 'var(--font-sans)' }}>
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 p-6 pt-3 flex flex-col gap-3">
                    <ul className="space-y-3">
                      {card.points.map((point, i) => (
                        <li key={i} className="flex items-start gap-3 group-hover:text-[#23291f] transition-colors duration-300"
                          style={{ color: isDark ? '#e5e7eb' : '#23291f' }}>
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3ed17b] mt-2 flex-shrink-0 shadow-md"></span>
                          <span className="text-base leading-relaxed font-medium" style={{ fontFamily: 'var(--font-sans)' }}>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 mt-6 sm:mt-8 justify-center">
          {industrySlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSlide(idx)}
              className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full transition-all duration-300 ${slide === idx ? 'bg-[#3ed17b] scale-125' : 'bg-gray-300 hover:bg-gray-400'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
