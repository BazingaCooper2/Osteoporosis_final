import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'OsteoScreen — Clinical Osteoporosis Detection',
  description: 'AI-assisted osteoporosis risk assessment from medical imaging. For clinical decision support only — not a substitute for professional medical judgment.',
  keywords: ['osteoporosis', 'DXA scan', 'bone density', 'clinical', 'AI detection', 'BMD'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="sr-only" style={{ position: 'absolute', top: '-40px', left: 0 }}>
          Skip to main content
        </a>
        <Header />
        <main id="main-content" tabIndex={-1} style={{ minHeight: 'calc(100vh - var(--header-height) - 180px)' }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
