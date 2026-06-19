import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import NextTopLoader from 'nextjs-toploader';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "wApi — Super Admin",
    template: "%s · wApi Super Admin",
  },
  description: "Internal control plane: workspaces, users, billing, operations, monitoring.",
  // Admin portal must never be indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased min-h-screen bg-background font-sans text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <NextTopLoader color="#2563eb" showSpinner={false} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
