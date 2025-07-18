import './globals.css';
import { Inter } from 'next/font/google';
// import SquircleWindow from '@/components/SquircleWindow';

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
    <html lang="en" style={{ borderRadius: '20px', overflow: 'hidden', backgroundColor: 'var(--background)' }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Force rounded corners on window load
              window.addEventListener('DOMContentLoaded', function() {
                const html = document.documentElement;
                const body = document.body;
                const next = document.getElementById('__next');

                // Apply responsive styling with rounded corners (match globals.css)
                if (html) {
                  html.style.borderRadius = '20px';
                  html.style.overflow = 'hidden';
                  html.style.backgroundColor = 'var(--background)';
                }

                if (body) {
                  body.style.backgroundColor = 'var(--background)';
                  body.style.color = 'var(--foreground)';
                  body.style.borderRadius = '20px';
                  body.style.overflow = 'hidden';
                  body.style.margin = '0';
                  body.style.padding = '0';
                }

                if (next) {
                  next.style.backgroundColor = 'var(--background)';
                  next.style.borderRadius = '20px';
                  next.style.setProperty('-electron-corner-smoothing', '80%');
                  next.style.overflow = 'hidden';
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
          borderRadius: '20px',
          overflow: 'hidden',
          margin: '0',
          padding: '0'
        }}
      >
        {children}
      </body>
    </html>
  );
}
