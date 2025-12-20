import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggleLime } from '@/components/theme-provider'
import GlobalErrorHandler from '@/components/GlobalErrorHandler'
import { SocketProvider } from '@/lib/SocketContext'
import LayoutWrapper from '@/components/LayoutWrapper'

export const metadata: Metadata = {
  title: 'Interakt - WhatsApp Marketing Platform',
  description: 'Create engaging WhatsApp ads that drive clicks and conversions. The ultimate WhatsApp marketing platform for businesses.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SocketProvider>
            <LayoutWrapper>
              <GlobalErrorHandler />
              {children}
            </LayoutWrapper>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 