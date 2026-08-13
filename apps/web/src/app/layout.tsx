import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Settlements',
  description: 'Track orders, record payments and see what is outstanding.',
};

// next-themes writes the class on <html> before paint, which the server render
// cannot know about.
const RootLayout = ({ children }: LayoutProps<'/'>) => (
  <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
    <body className="flex min-h-full flex-col">
      <ThemeProvider>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
