"use client";

export default function TestimonialSection({ isDark }: { isDark: boolean }) {
  const cardBg = isDark ? '#111' : '#fff';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'wApi';

  return (
    <section className="w-full bg-white dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center" style={{ backgroundColor: isDark ? '#000' : '#fff' }}>
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 sm:gap-10 md:gap-12 px-4 sm:px-6">
        <div className="flex-1 flex flex-col justify-center items-start relative">
          <svg width="120" height="120" viewBox="0 0 48 48" fill="none" className="absolute -top-6 -left-6 md:-top-8 md:-left-8 opacity-20 z-0" style={{ color: '#13C18D', transform: 'rotate(-15deg)' }} xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5 8C10.6 8 6 13.6 6 21.5c0 5.5 3.4 10.3 8.8 11.7V40c0 2 1.3 3.5 3.5 3.5s3.5-1.5 3.5-3.5V21.5C21.8 13.6 17.5 8 17.5 8z" fill="currentColor" />
          </svg>
          <div className="relative z-10">
            <p className="text-2xl md:text-3xl font-medium italic text-foreground leading-snug">
              We were able to increase our revenue from the first Diwali to the second Diwali to approximately 4× of what we did and we couldn't have done this without the help of {appName}.
            </p>
            <div className="mt-4">
              <span className="text-primary font-bold text-4xl">Yash Banage</span><br />
              <span className="text-2xl font-bold text-foreground">Co-founder, Bombay Sweet Shop</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex justify-center items-center">
          <img src="https://images.unsplash.com/photo-1565958011057-06d4a8ff0b58?w=600&h=600&fit=crop" alt="Bombay Sweet Shop" className="object-contain w-[420px] h-[420px] md:w-[520px] md:h-[520px] rounded-2xl" />
        </div>
      </div>
      <div className="w-full max-w-5xl mt-4 sm:mt-6 flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 justify-center items-center px-4">
        {[
          { stat: '1.56L', label: 'revenue generated in a day' },
          { stat: '40%', label: 'customer queries handled by Boondi – the bot' },
          { stat: '4X', label: `increase in revenue since onboarding with ${appName}` }
        ].map((item, idx) => (
          <div key={idx} className="flex-1 min-w-[250px] sm:min-w-[300px] h-[140px] sm:h-[170px] bg-white border-2 border-[#ffe6b3] rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center text-center shadow-sm justify-center" style={{ backgroundColor: cardBg }}>
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0e3c2c] mb-2">{item.stat}</span>
            <span className="text-sm sm:text-base md:text-xl text-foreground text-center">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
