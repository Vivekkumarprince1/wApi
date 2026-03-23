
import { Inter, Quicksand, Geist } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import GlobalErrorHandler from '@/components/shared/GlobalErrorHandler'
import LayoutWrapper from '@/components/layout/LayoutWrapper'
import QueryProvider from '@/components/providers/QueryProvider'
import ToastProvider from '@/components/providers/ToastProvider'
import { AuthInitializer } from '@/components/providers/AuthInitializer'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={cn(inter.variable, quicksand.variable, "font-sans", geist.variable)}>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            
              <AuthInitializer />
              <LayoutWrapper>
                <GlobalErrorHandler />
                <ToastProvider />
                {children}
              </LayoutWrapper>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}