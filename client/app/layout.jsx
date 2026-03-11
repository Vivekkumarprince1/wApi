
import { Inter, Quicksand } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import GlobalErrorHandler from '@/components/shared/GlobalErrorHandler'
import { SocketProvider } from '@/lib/SocketContext'
import { AuthProvider } from '@/lib/AuthProvider'
import LayoutWrapper from '@/components/layout/LayoutWrapper'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata = {
  title: `${process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} - WhatsApp Marketing Platform`,
  description: 'Create engaging WhatsApp ads that drive clicks and conversions. The ultimate WhatsApp marketing platform for businesses.',
}

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${quicksand.variable}`}>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SocketProvider>
            <AuthProvider>
              <LayoutWrapper>
                <GlobalErrorHandler />
                {children}
              </LayoutWrapper>
            </AuthProvider>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}