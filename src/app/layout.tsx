import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '../contexts/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', 'arial']
});

export const metadata = {
  title: 'LittleLLM Chat',
  description: 'A simple chat interface for LittleLLM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>

      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
