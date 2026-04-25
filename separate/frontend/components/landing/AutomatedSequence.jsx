"use client";

export default function AutomatedSequence({ isDark }) {
  return (
    <section
      className="w-full py-16 px-4 flex items-center justify-center"
      style={{ backgroundColor: isDark ? '#000' : '#f4ffe9' }}
    >
      <div className="max-w-7xl w-full flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16">
        <div className="flex-1 flex flex-col items-start justify-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: isDark ? '#fff' : '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
            Create and send an <span style={{ color: '#3ed17b' }}>automated</span> sequence of WhatsApp messages
          </h2>
          <p className="text-lg sm:text-xl mt-2 mb-8" style={{ color: isDark ? '#ccc' : '#23291f', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            Transcend beyond the realm of standard templates and leave a lasting impression on your customers and prospects with the power of AI-assisted personalization.
          </p>
          <ul className="space-y-6 w-full">
            <li className="flex items-center gap-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3ed17b] bg-opacity-20">
                <svg width="24" height="24" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2l4-4" /><circle cx="12" cy="12" r="10" /></svg>
              </span>
              <span className="text-lg font-semibold" style={{ color: isDark ? '#fff' : '#23291f' }}>Increase your customer engagement in a jiffy by automating!</span>
            </li>
            <li className="flex items-center gap-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3ed17b] bg-opacity-20">
                <svg width="24" height="24" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              </span>
              <span className="text-lg font-semibold" style={{ color: isDark ? '#fff' : '#23291f' }}>Sending a series of messages to your prospects</span>
            </li>
            <li className="flex items-center gap-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3ed17b] bg-opacity-20">
                <svg width="24" height="24" fill="none" stroke="#3ed17b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg>
              </span>
              <span className="text-lg font-semibold" style={{ color: isDark ? '#fff' : '#23291f' }}>Use cases for sequence page</span>
            </li>
          </ul>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <img
            src="https://images.unsplash.com/photo-1512941691920-25bda36e892d?w=600&h=1000&fit=crop"
            alt="WhatsApp Mockup"
            className="w-full max-w-xl rounded-2xl shadow-premium border border-[#e0f7d9]"
            style={{ background: '#e0f7d9' }}
          />
        </div>
      </div>
    </section>
  );
}
