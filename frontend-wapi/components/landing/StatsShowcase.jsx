"use client";

import { motion } from 'framer-motion';

export default function StatsShowcase({ isDark }) {
  const stats = [
    { number: '10M+', label: 'Messages Sent', icon: '💬' },
    { number: '50K+', label: 'Active Contacts', icon: '👥' },
    { number: '95%', label: 'Customer Satisfaction', icon: '⭐' },
    { number: '24/7', label: 'Support Available', icon: '🎯' },
  ];

  return (
    <section className="w-full py-16 px-4 flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: isDark ? '#000' : '#fff' }}>
      <div className="max-w-7xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: isDark ? '#ffffff' : '#1a202c' }}>
            Trusted by <span className="text-primary">10,000+</span> Businesses
          </h2>
          <p className="text-lg text-muted-foreground">Powering growth across industries worldwide</p>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="text-center p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 shadow-premium hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                {stat.number}
              </div>
              <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
