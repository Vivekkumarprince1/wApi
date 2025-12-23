'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [showHeader, setShowHeader] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  
  useEffect(() => {
    // Show header only if user is logged in
    const token = localStorage.getItem('token');
    setShowHeader(!!token);
    
    // Listen for storage changes and custom auth changes to update header visibility
    const handleAuthChange = () => {
      const token = localStorage.getItem('token');
      setShowHeader(!!token);
    };
    
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('authChange', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const handleSectionChange = (section: string) => {
    setSidebarOpen(false);
  };
  
  return (
    <>
      {showHeader && <Header />}
      {showHeader && (
        <>
          <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            onSectionChange={handleSectionChange}
            currentPath={pathname}
          />
          
          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
      <div className={showHeader ? 'lg:ml-16' : ''}>
        {children}
      </div>
    </>
  );
}
