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
    <html lang="en" style={{ borderRadius: '20px', overflow: 'hidden', background: '#1a1a1a' }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Force rounded corners on window load
              window.addEventListener('DOMContentLoaded', function() {
                const html = document.documentElement;
                const body = document.body;
                const next = document.getElementById('__next');

                // Apply aggressive styling with more rounded corners
                [html, body, next].forEach(el => {
                  if (el) {
                    el.style.borderRadius = '20px';
                    el.style.overflow = 'hidden';
                    el.style.background = '#1a1a1a';
                    el.style.setProperty('-electron-corner-smoothing', '80%');
                    el.style.clipPath = 'polygon(20px 0%, calc(100% - 20px) 0%, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0% calc(100% - 20px), 0% 20px)';
                  }
                });
              });
            `,
          }}
        />
      </head>
      <body
        className={inter.className}
        style={{
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          borderRadius: '20px',
          overflow: 'hidden',
          margin: 0,
          padding: 0
        }}
      >
        {children}
      </body>
    </html>
  );
}
