import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Secure Commerce', template: '%s · Secure Commerce' },
  description: 'MVP thương mại điện tử với mã hóa hybrid RSA + AES ở lớp ứng dụng.',
  applicationName: 'Secure Commerce',
  keywords: ['thương mại điện tử', 'Next.js', 'NestJS', 'RSA-OAEP', 'AES-GCM'],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    title: 'Secure Commerce',
    description: 'Mua sắm hiện đại với luồng giao dịch được thiết kế theo hướng phòng vệ nhiều lớp.',
    siteName: 'Secure Commerce',
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light', themeColor: '#0c1b2a' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="vi"><body><Providers><SiteHeader /><main className="main-content">{children}</main><SiteFooter /></Providers></body></html>;
}
