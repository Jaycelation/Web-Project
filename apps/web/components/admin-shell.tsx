'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { LoadingState } from './loading-state';

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, loading } = useAuth();
  useEffect(() => { if (!loading && (!user || !['ADMIN', 'STAFF'].includes(user.role))) router.replace('/dang-nhap?next=/quan-tri'); }, [loading, router, user]);
  if (loading || !user || !['ADMIN', 'STAFF'].includes(user.role)) return <LoadingState label="Đang kiểm tra quyền quản trị…" />;
  return <div className="admin-shell"><aside className="admin-sidebar"><h2>MIRA OPERATIONS</h2><nav><Link className={pathname === '/quan-tri' ? 'active' : ''} href="/quan-tri">Tổng quan</Link><Link className={pathname.startsWith('/quan-tri/san-pham') ? 'active' : ''} href="/quan-tri/san-pham">Sản phẩm & tồn kho</Link><Link className={pathname.startsWith('/quan-tri/don-hang') ? 'active' : ''} href="/quan-tri/don-hang">Đơn hàng</Link><Link href="/tai-khoan">Tài khoản của tôi</Link><Link href="/">Về cửa hàng</Link></nav></aside><div className="admin-main">{children}</div></div>;
}
