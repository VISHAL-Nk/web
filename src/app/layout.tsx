import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EchoSight — Customer Review Intelligence",
  description:
    "AI-powered platform for analyzing customer reviews with fraud detection, trend analysis, and actionable insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-zinc-950 text-white`}>
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
          <Toaster theme="dark" position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
