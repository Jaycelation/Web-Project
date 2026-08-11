'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';
import { useCart } from './cart-provider';
import { CartIcon, SearchIcon, ShieldIcon, UserIcon } from './icons';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount } = useCart();
  const { user, loading, logout } = useAuth();
  const [query, setQuery] = useState('');

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/san-pham?q=${encodeURIComponent(value)}` : '/san-pham');
  };

  return <>
    <div className="announcement">
      <div className="container announcement-inner">
        <span><ShieldIcon /> Giao dịch bọc RSA‑OAEP + AES‑256‑GCM</span>
        <span className="announcement-secondary">Miễn phí vận chuyển từ 1.000.000 ₫</span>
      </div>
    </div>
    <header className="site-header">
      <div className="container header-main">
        <Link href="/" className="brand" aria-label="Secure Commerce - Trang chủ">
          <span className="brand-mark"><ShieldIcon /></span>
          <span><strong>SECURE</strong><small>COMMERCE</small></span>
        </Link>

        <form className="header-search" onSubmit={submitSearch} role="search">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm, mã SKU…" aria-label="Tìm kiếm sản phẩm" />
          <button type="submit">Tìm</button>
        </form>

        <nav className="header-actions" aria-label="Tài khoản và giỏ hàng">
          <Link className="header-action" href={user ? '/tai-khoan' : '/dang-nhap'}>
            <UserIcon />
            <span><small>{loading ? 'Đang tải' : user ? 'Xin chào' : 'Tài khoản'}</small><strong>{user?.name ?? 'Đăng nhập'}</strong></span>
          </Link>
          <Link className="header-action cart-action" href="/gio-hang">
            <CartIcon />
            <span><small>Giỏ hàng</small><strong>{itemCount} sản phẩm</strong></span>
            {itemCount > 0 && <b className="cart-count">{itemCount}</b>}
          </Link>
        </nav>
      </div>
      <div className="header-nav-wrap">
        <div className="container header-nav">
          <nav aria-label="Điều hướng chính">
            <Link className={pathname === '/' ? 'active' : ''} href="/">Trang chủ</Link>
            <Link className={pathname.startsWith('/san-pham') ? 'active' : ''} href="/san-pham">Sản phẩm</Link>
            <Link href="/san-pham?sort=popular">Bán chạy</Link>
            <Link href="/san-pham?sort=newest">Mới về</Link>
            <Link className={pathname.startsWith('/tra-cuu') ? 'active' : ''} href="/tra-cuu-don-hang">Tra cứu đơn</Link>
            {user?.role === 'ADMIN' || user?.role === 'STAFF' ? <Link href="/quan-tri">Quản trị</Link> : null}
          </nav>
          <div className="header-nav-meta">
            <span>Hotline: <strong>1900 2026</strong></span>
            {user && <button type="button" className="link-button" onClick={() => void logout()}>Đăng xuất</button>}
          </div>
        </div>
      </div>
    </header>
  </>;
}
