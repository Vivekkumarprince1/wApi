import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";

const inter = { variable: "font-sans" };

export const metadata: Metadata = {
  title: {
    default: "ConnectSphere Super Admin",
    template: "%s · ConnectSphere Super Admin",
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
          <NextTopLoader color="#006c49" showSpinner={false} />
          <Toaster richColors position="top-right" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
