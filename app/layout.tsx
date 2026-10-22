import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AutoHideScrollbars } from "@/components/auto-hide-scrollbars";
import { KeepFocusedFieldVisible } from "@/components/keep-focused-field-visible";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "OpenTill",
  description: "Point of sale",
  icons: {
    icon: [
      { url: "/icon-light.png", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.png", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

// "resizes-content": when a phone keyboard opens, the page shrinks to the space above it (Chrome, Android),
// so full-height screens and dialogs stay above the keyboard instead of underneath it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${figtree.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <AutoHideScrollbars />
        <KeepFocusedFieldVisible />
        <TooltipProvider>
          <AuthProvider>{children}</AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
