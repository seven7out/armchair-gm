import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://thearmchairgm.com'),
  title: 'Armchair GM — Front Office Notebook & Cap Ledger',
  description:
    'An editorial NFL salary cap notebook, multi-year roster horizon, and draft pick trade simulator.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Armchair GM — Front Office Notebook & Cap Ledger',
    description:
      'Interactive NFL salary cap manager, multi-year roster timeline, and offseason simulator for all 32 teams.',
    url: 'https://thearmchairgm.com',
    siteName: 'Armchair GM',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body className="antialiased selection:bg-[#d8572a]/15 selection:text-[#1c1917]">
        {children}
      </body>
    </html>
  );
}
