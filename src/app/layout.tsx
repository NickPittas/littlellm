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
    <html lang="en" style={{ borderRadius: '32px', overflow: 'hidden', backgroundColor: 'var(--background)', border: '0px solid transparent', outline: 'none', boxShadow: 'none' }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Force rounded corners on window load
              window.addEventListener('DOMContentLoaded', function() {
                const html = document.documentElement;
                const body = document.body;
                const next = document.getElementById('__next');

                // Apply styling with much bigger rounded corners but no borders (match globals.css)
                if (html) {
                  html.style.borderRadius = '32px';
                  html.style.overflow = 'hidden';
                  html.style.backgroundColor = 'var(--background)';
                  html.style.border = '0px solid transparent';
                  html.style.outline = 'none';
                  html.style.boxShadow = 'none';
                }

                if (body) {
                  body.style.backgroundColor = 'var(--background)';
                  body.style.color = 'var(--foreground)';
                  body.style.borderRadius = '32px';
                  body.style.overflow = 'hidden';
                  body.style.margin = '0';
                  body.style.padding = '0';
                  body.style.border = '0px solid transparent';
                  body.style.outline = 'none';
                  body.style.boxShadow = 'none';
                }

                if (next) {
                  next.style.backgroundColor = 'var(--background)';
                  next.style.borderRadius = '32px';
                  next.style.overflow = 'hidden';
                  next.style.border = '0px solid transparent';
                  next.style.outline = 'none';
                  next.style.boxShadow = 'none';
                }
              });
            `,
          }}
        />
      </head>
      <body
        className={inter.className}
        style={{
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          borderRadius: '32px',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
          border: '0px solid transparent',
          outline: 'none',
          boxShadow: 'none'
        }}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
