import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Armchair GM — NFL Front-Office Sandbox & Multi-Year Cap Simulator',
  description:
    'Interactive NFL salary cap, multi-year roster construction, positional aging curves, and draft pick trade simulator.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
