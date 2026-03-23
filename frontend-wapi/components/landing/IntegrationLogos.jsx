"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationLogos({ isDark }) {
  const router = useRouter();
  const [activeButton, setActiveButton] = useState(null);

  const logos = [
    { src: 'https://cdn.worldvectorlogo.com/logos/facebook-3.svg', alt: 'Facebook Ads' },
    { src: 'https://cdn.worldvectorlogo.com/logos/google-sheets-1.svg', alt: 'Google Sheets' },
    { src: 'https://cdn.worldvectorlogo.com/logos/woocommerce.svg', alt: 'WooCommerce' },
    { src: 'https://cdn.worldvectorlogo.com/logos/shopify.svg', alt: 'Shopify' },
    { src: 'https://cdn.worldvectorlogo.com/logos/zoho.svg', alt: 'Zoho CRM' },
    { src: 'https://cdn.worldvectorlogo.com/logos/pabbly.svg', alt: 'Pabbly' }
  ];

  return (
    <section className="w-full bg-white dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center border-t border-border/50" style={{ backgroundColor: isDark ? '#000' : '#fff' }}>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 sm:mb-8 md:mb-10 text-black dark:text-foreground px-4">
        Integrates easily with <span className="text-primary">60+</span> platforms
      </h2>
      <div className="flex flex-row justify-center items-center gap-x-6 sm:gap-x-8 md:gap-x-12 mb-8 sm:mb-10 md:mb-12 w-full max-w-5xl overflow-x-auto scrollbar-hide px-2 sm:px-4">
        {logos.map((logo, idx) => (
          <img key={idx} src={logo.src} alt={logo.alt} className="h-12 sm:h-14 md:h-16 w-24 sm:w-32 md:w-40 object-contain" />
        ))}
      </div>
      <button
        onClick={() => {
          setActiveButton('platforms');
          router.push('/auth/register');
        }}
        className={`font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base md:text-lg shadow-premium transition-all duration-500 transform ${activeButton === 'platforms'
          ? 'bg-[#CCFF00] text-black scale-105 shadow-2xl'
          : 'bg-[#CCFF00] text-black hover:bg-[#BFFF00] hover:shadow-2xl hover:scale-110 hover:-translate-y-1'
          }`}
      >
        Get Started With Free Trial
      </button>
    </section>
  );
}
