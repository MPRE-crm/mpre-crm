import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MPRE CRM",
  description: "Lead management, call logs, and automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-60 bg-gray-100 p-4 shadow-md">
            <h2 className="text-xl font-bold mb-6">CRM</h2>
            <nav className="flex flex-col space-y-4">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <Link href="/dashboard/leads" className="hover:underline">
                Leads
              </Link>
              <Link href="/dashboard/call-logs" className="hover:underline">
                Call Logs
              </Link>
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
