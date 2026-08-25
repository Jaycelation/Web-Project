'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { LoadingState } from './loading-state';

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  useEffect(() => { if (!loading && !user) router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`); }, [loading, pathname, router, user]);
  if (loading || !user) return <LoadingState label="Đang xác thực tài khoản…" />;
  const initial = user.name.trim().charAt(0).toUpperCase();
  return <div className="account-layout"><aside className="account-sidebar"><div className="account-user"><div className="account-avatar">{initial}</div><strong>{user.name}</strong><small>{user.email}</small></div><nav className="account-nav"><Link className={pathname === '/tai-khoan' ? 'active' : ''} href="/tai-khoan">Tổng quan</Link><Link className={pathname.startsWith('/tai-khoan/don-hang') ? 'active' : ''} href="/tai-khoan/don-hang">Đơn hàng</Link><Link className={pathname.startsWith('/tai-khoan/bao-mat') ? 'active' : ''} href="/tai-khoan/bao-mat">Đổi mật khẩu</Link><button className="account-logout" type="button" onClick={() => void logout()}>Đăng xuất</button></nav></aside><div className="account-content">{children}</div></div>;
}
