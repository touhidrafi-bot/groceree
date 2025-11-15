import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { AuthProvider } from '../components/AuthProvider';
import { CartProvider } from '../components/EnhancedCartProvider';
import ReaddyWidget from '../components/ReaddyWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Groceree - Fresh Grocery Delivery in Vancouver',
  description:
    'Get fresh, high-quality groceries delivered to your door in Vancouver, BC. Same-day delivery, best prices, and premium organic produce.',
  icons: {
    icon: '/images/logo-favicon.jfif',
    shortcut:
      '/images/logo-favicon.jfif',
    apple:
      '/images/logo-favicon.jfif',
  },
  openGraph: {
    title: 'Groceree - Fresh Grocery Delivery in Vancouver',
    description:
      'Get fresh, high-quality groceries delivered to your door in Vancouver, BC. Same-day delivery, best prices, and premium organic produce.',
    images: [
      '/images/full-logo.jfif',
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="/images/logo-favicon.jfif"
          type="image/png"
        />
        <link
          rel="shortcut icon"
          href="/images/logo-favicon.jfif"
          type="image/png"
        />
        <meta
          property="og:image"
          content="/images/full-logo.jfif"
        />
        <style suppressHydrationWarning>{`
          @media (max-width: 768px) {
            #vapi-widget-floating-button {
              width: 48px !important;
              height: 48px !important;
              font-size: 18px !important;
              bottom: 20px !important;
              right: 16px !important;
            }
            .vapi-widget-container {
              width: calc(100vw - 32px) !important;
              max-width: 320px !important;
              height: calc(100vh - 120px) !important;
              max-height: 500px !important;
              bottom: 80px !important;
              right: 16px !important;
              left: 16px !important;
              margin: 0 auto !important;
            }
            .vapi-widget-container .vapi-h-10 {
              height: 36px !important;
              width: 36px !important;
            }
            .vapi-conversation-area {
              height: calc(100% - 140px) !important;
              min-height: 200px !important;
            }
            .vapi-widget-container input {
              font-size: 16px !important;
              padding: 8px 12px !important;
            }
            .vapi-widget-container button {
              min-width: 36px !important;
              min-height: 36px !important;
            }
          }

          @media (max-width: 480px) {
            .vapi-widget-container {
              width: calc(100vw - 24px) !important;
              height: calc(100vh - 100px) !important;
              max-height: 450px !important;
              bottom: 70px !important;
              right: 12px !important;
              left: 12px !important;
            }
            #vapi-widget-floating-button {
              width: 44px !important;
              height: 44px !important;
              bottom: 16px !important;
              right: 12px !important;
            }
            .vapi-conversation-area {
              padding: 12px !important;
            }
          }

          @media (max-height: 600px) {
            .vapi-widget-container {
              height: calc(100vh - 80px) !important;
              max-height: 400px !important;
            }
          }

          #vapi-widget-floating-button {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            width: 56px !important;
            height: 56px !important;
            z-index: 1000 !important;
          }

          #vapi-widget-floating-button svg {
            display: none !important;
          }

          #vapi-widget-floating-button .vapi-flex {
            display: none !important;
          }

          #vapi-widget-floating-button::before {
            content: '';
            width: 56px;
            height: 56px;
            background-image: url('/images/logo-favicon.jfif');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            border-radius: 8px;
            display: block;
            cursor: pointer;
            transition: transform 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }

          #vapi-widget-floating-button:hover::before {
            transform: scale(1.05);
          }

          .vapi-widget-container {
            z-index: 999 !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
            border-radius: 16px !important;
          }

          @media (max-width: 768px) {
            #vapi-widget-floating-button::before {
              width: 48px !important;
              height: 48px !important;
            }
          }

          @media (max-width: 480px) {
            #vapi-widget-floating-button::before {
              width: 44px !important;
              height: 44px !important;
            }
          }
        `}</style>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            <Header />
            {children}
            <Footer />

            {/* Readdy widget injected by client component to avoid TS prop type issues with Next.js Script */}
            <ReaddyWidget />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
