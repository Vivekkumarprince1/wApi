import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import QueryProvider from "@/components/providers/query-provider";
import ToastProvider from "@/components/providers/toast-provider";
import { AuthInitializer } from "@/components/providers/auth-initializer";
import { CommandCenter } from "@/components/dashboard/command-center";
import GlobalDashboardLayout from "@/components/layout/dashboard-layout";

/*
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});
*/

const inter = { variable: "font-inter" };
const manrope = { variable: "font-manrope" };

export const metadata: Metadata = {
  title: "wApi - WhatsApp CRM & Engagement Platform",
  description: "High-performance WhatsApp Business API platform for CRM, Marketing, and Automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${manrope.variable} antialiased min-h-screen bg-background font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <TooltipProvider>
              <AuthInitializer />
              <ToastProvider />
              <CommandCenter />
              <GlobalDashboardLayout>{children}</GlobalDashboardLayout>
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


