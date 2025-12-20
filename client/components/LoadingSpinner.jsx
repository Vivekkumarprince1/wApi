import Image from 'next/image';

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f4f8] via-[#e8f0fe] to-[#f3e5f5]">
      <div className="text-center">
        <div className="relative mb-6">
          {/* Logo with spinning animation */}
          <div className="w-20 h-20 mx-auto relative">
            <Image
              src="/interact-logo.png"
              alt="Interakt Logo"
              width={80}
              height={80}
              className="animate-pulse"
            />
            {/* Spinning ring around the logo */}
            <div className="absolute inset-0 border-4 border-t-green-500 border-b-green-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">Interakt</h2>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center mt-4 space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner; 