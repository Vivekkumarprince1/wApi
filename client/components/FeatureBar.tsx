import { useEffect, useState } from 'react';
import { BadgeCheck, MessageCircle, Users, Workflow, BarChart3, Shield } from 'lucide-react';

const features = [
  {
    icon: BadgeCheck,
    title: 'Get Green Tick Verfied',
  },
  {
    icon: MessageCircle,
    title: 'One time & recurring Campaigns on WhatsApp',
  },
  {
    icon: Users,
    title: 'Shared Team Inbox with auto chat assignment',
  },
  {
    icon: Workflow,
    title: 'Build your own Workflows',
  },
  {
    icon: BarChart3,
    title: 'Campaign & Agent Analytics',
  },
  {
    icon: Shield,
    title: 'Simplicity for SMBs with Enterprise grade Scale & Security',
  },
];

export default function FeatureBar() {
  const [barBg, setBarBg] = useState('#fafaf0');
  useEffect(() => {
    const updateBg = () => {
      if (document.documentElement.classList.contains('dark')) {
        setBarBg('#000');
      } else {
        setBarBg('#fafaf0');
      }
    };
    updateBg();
    const observer = new MutationObserver(updateBg);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full py-3 sm:py-4 md:py-5 transition-colors duration-300" style={{ backgroundColor: barBg }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch justify-between divide-y sm:divide-y-0 sm:divide-x divide-[#8ee0d0] dark:divide-gray-700 px-2 sm:px-4">
        {features.map((feature, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center sm:items-start px-2 sm:px-3 py-2 group">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-200/50 via-gray-100/30 to-gray-50/20 dark:from-gray-800/70 dark:via-gray-700/50 dark:to-gray-900/30 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 mb-2">
              <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white transition-colors duration-300" />
            </div>
            <span className="text-xs sm:text-sm md:text-base font-semibold text-[#00332a] dark:text-gray-200 text-center sm:text-left group-hover:text-gray-800 dark:group-hover:text-white transition-colors duration-300 leading-tight" style={{fontFamily: 'Montserrat, Inter, system-ui, -apple-system, sans-serif'}}>
              {feature.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
} 