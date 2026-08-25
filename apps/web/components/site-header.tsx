'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';
import { useCart } from './cart-provider';
import { CartIcon, SearchIcon, SparkleIcon, UserIcon } from './icons';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount } = useCart();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState('');

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/san-pham?q=${encodeURIComponent(value)}` : '/san-pham');
  };

  return <>
    <div className="announcement">
      <div className="container announcement-inner">
        <span><SparkleIcon /> Freeship cho đơn từ 1.000.000 ₫</span>
        <span className="announcement-secondary">Đổi trả dễ dàng trong 7 ngày</span>
      </div>
    </div>
    <header className="site-header">
      <div className="container header-main">
        <Link href="/" className="brand" aria-label="MIRA - Trang chủ">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span><strong>MIRA</strong><small>SMART LIVING</small></span>
        </Link>

        <nav className="primary-nav" aria-label="Điều hướng chính">
          <Link className={pathname === '/san-pham' ? 'active' : ''} href="/san-pham">Sản phẩm</Link>
          <Link href="/san-pham?sort=newest">Hàng mới</Link>
          <Link href="/san-pham?sort=popular">Bán chạy</Link>
        </nav>

        <form className="header-search" onSubmit={submitSearch} role="search">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm công nghệ…" aria-label="Tìm kiếm sản phẩm" />
          <button type="submit" aria-label="Tìm kiếm"><SearchIcon /></button>
        </form>

        <nav className="header-actions" aria-label="Tài khoản và giỏ hàng">
          <Link className="header-action" href={user ? '/tai-khoan' : '/dang-nhap'} aria-label={user ? 'Tài khoản của tôi' : 'Đăng nhập'}>
            <UserIcon />
            <span><small>{loading ? 'Đang tải' : 'Tài khoản'}</small><strong>{user?.name ?? 'Đăng nhập'}</strong></span>
          </Link>
          <Link className="header-action cart-action" href="/gio-hang" aria-label={`Giỏ hàng có ${itemCount} sản phẩm`}>
            <CartIcon />
            <span><small>Giỏ hàng</small><strong>{itemCount ? `${itemCount} sản phẩm` : 'Đang trống'}</strong></span>
            {itemCount > 0 && <b className="cart-count">{itemCount}</b>}
          </Link>
        </nav>
      </div>
    </header>
  </>;
}
