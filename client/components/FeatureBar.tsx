import { useEffect, useState } from 'react';
import { BadgeCheck, MessageCircle, Users, Workflow, BarChart3, Shield, Zap, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: MessageCircle,
    title: 'WhatsApp Campaigns',
    description: 'Send bulk messages & campaigns'
  },
  {
    icon: Users,
    title: 'Shared Inbox',
    description: 'Manage all chats in one place'
  },
  {
    icon: Workflow,
    title: 'Automation',
    description: 'Build chatbots & workflows'
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Track performance & ROI'
  },
  {
    icon: BadgeCheck,
    title: 'Green Tick',
    description: 'Get verified instantly'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-grade data protection'
  },
];

export default function FeatureBar() {
  const [barBg, setBarBg] = useState('#ffffff');
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    const updateBg = () => {
      const dark = document.documentElement.classList.contains('dark');
      setIsDark(dark);
      if (dark) {
        setBarBg('#0a0a0a');
      } else {
        setBarBg('#ffffff');
      }
    };
    updateBg();
    const observer = new MutationObserver(updateBg);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full py-16 transition-colors duration-300" style={{ backgroundColor: barBg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Title */}
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
            style={{ color: isDark ? '#ffffff' : '#1a202c' }}
          >
            Everything you need to succeed on WhatsApp
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
          >
            All-in-one platform to manage customer conversations, automate marketing, and grow your business
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group relative p-6 rounded-2xl transition-all duration-300 hover:scale-105 cursor-pointer"
              style={{
                backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
              }}
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-4 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] shadow-lg group-hover:shadow-xl transition-all duration-300">
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              
              {/* Title */}
              <h3 
                className="text-xl font-bold mb-2 group-hover:text-[#13C18D] transition-colors duration-300"
                style={{ color: isDark ? '#ffffff' : '#1a202c' }}
              >
                {feature.title}
              </h3>
              
              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#13C18D]/10 to-[#0e8c6c]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
} 