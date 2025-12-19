import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { cookieToInitialState } from 'wagmi';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { config } from '@/lib/wagmi';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Arc Agents - Launch AI Agents for Commerce',
  description: 'Deploy autonomous AI agents that transact via x402. Verify execution, pay in USDC, on Arc L1.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get initial state from cookies for SSR hydration
  const headersList = await headers();
  const cookie = headersList.get('cookie');
  const initialState = cookieToInitialState(config, cookie);

  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers initialState={initialState}>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <Header />
            <main className="container mx-auto px-4 py-8 flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
