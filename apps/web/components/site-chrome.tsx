'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

const AUTH_PATHS = ['/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau'];

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isBackOffice = pathname.startsWith('/quan-tri');
  const standalone = isAuth || isBackOffice;

  return <>
    {!standalone && <SiteHeader />}
    <main className={`main-content${standalone ? ' main-content-standalone' : ''}`}>{children}</main>
    {!standalone && <SiteFooter />}
  </>;
}
