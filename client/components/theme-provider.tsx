"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { Sun, Moon } from "lucide-react"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}
      </button>
    </div>
  )
} 

// New lime yellow toggle button
export function ThemeToggleLime() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="fixed top-4 right-4 z-[100]">
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-3 rounded-full bg-[#CCFF00] border-2 border-black shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-black" />
        ) : (
          <Moon className="w-5 h-5 text-black" />
        )}
      </button>
    </div>
  );
} 