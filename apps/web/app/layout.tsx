import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SiteChrome } from '@/components/site-chrome';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'MIRA · Công nghệ cho cuộc sống hiện đại', template: '%s · MIRA' },
  description: 'Khám phá điện thoại, thiết bị âm thanh và phụ kiện công nghệ được tuyển chọn tại MIRA.',
  applicationName: 'MIRA',
  keywords: ['MIRA', 'mua sắm công nghệ', 'điện thoại', 'tai nghe', 'phụ kiện'],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    title: 'MIRA · Công nghệ cho cuộc sống hiện đại',
    description: 'Thiết bị công nghệ được tuyển chọn cho công việc và nhịp sống mỗi ngày.',
    siteName: 'MIRA',
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light', themeColor: '#f7f7f5' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="vi"><body><Providers><SiteChrome>{children}</SiteChrome></Providers></body></html>;
}
