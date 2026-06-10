"use client";

import { motion } from 'framer-motion';

export default function FeatureGrid({ isDark }: { isDark: boolean }) {
  const features = [
    {
      title: 'Unified Inbox',
      description: 'Manage all customer conversations from a single, powerful dashboard',
      icon: '💬',
      features: ['Multi-agent support', 'Smart routing', 'Chat history']
    },
    {
      title: 'Smart Automation',
      description: 'Automate repetitive tasks and scale your customer engagement',
      icon: '🤖',
      features: ['AI chatbots', 'Auto-replies', 'Workflows']
    },
    {
      title: 'Campaign Manager',
      description: 'Launch targeted WhatsApp campaigns that drive real results',
      icon: '📢',
      features: ['Bulk messaging', 'Scheduling', 'Analytics']
    },
    {
      title: 'Commerce Tools',
      description: 'Sell products directly through WhatsApp with integrated payments',
      icon: '🛒',
      features: ['Product catalog', 'Order tracking', 'Payment gateway']
    },
    {
      title: 'Analytics & Reports',
      description: 'Track performance with detailed insights and metrics',
      icon: '📊',
      features: ['Real-time dashboard', 'Custom reports', 'Export data']
    },
    {
      title: 'Integrations',
      description: 'Connect with your favorite tools and platforms seamlessly',
      icon: '🔗',
      features: ['CRM sync', 'E-commerce', 'API access']
    },
  ];

  return (
    <section className="w-full py-20 px-4 flex items-center justify-center" style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      <div className="max-w-7xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: isDark ? '#ffffff' : '#1a202c' }}>
            Everything You Need in <span className="text-primary">One Platform</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to help you grow your business on WhatsApp
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-card rounded-2xl p-8 shadow-premium hover:shadow-2xl transition-all duration-300 hover:scale-105 group"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#1a202c' }}>{feature.title}</h3>
                  <p className="text-muted-foreground mb-4">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.features.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
