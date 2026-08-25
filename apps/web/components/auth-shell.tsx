import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HeadsetIcon, PackageIcon, RefreshIcon } from './icons';

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="auth-section">
    <div className="auth-shell">
      <aside className="auth-aside">
        <Link href="/" className="brand brand-light" aria-label="MIRA - Trang chủ"><span className="brand-mark" aria-hidden="true">M</span><span><strong>MIRA</strong><small>SMART LIVING</small></span></Link>
        <div className="auth-aside-copy"><span className="eyebrow eyebrow-light">MIRA MEMBERS</span><h1>Mọi đơn hàng,<br />gói gọn một nơi.</h1><p>Theo dõi hành trình giao hàng, lưu thông tin nhận hàng và khám phá ưu đãi dành riêng cho bạn.</p></div>
        <div className="auth-perks"><div className="auth-feature"><PackageIcon /> Theo dõi đơn hàng thuận tiện</div><div className="auth-feature"><RefreshIcon /> Đổi trả nhanh chóng</div><div className="auth-feature"><HeadsetIcon /> Hỗ trợ khi bạn cần</div></div>
        <Image className="auth-product-image" src="/products/headphones.svg" alt="" width={420} height={326} priority />
      </aside>
      <div className="auth-form">
        <Link href="/" className="auth-mobile-brand" aria-label="MIRA - Trang chủ">MIRA</Link>
        <Link href="/" className="auth-back">← Về trang chủ</Link>
        <div className="auth-form-heading"><h2>{title}</h2><p>{description}</p></div>
        {children}
      </div>
    </div>
  </section>;
}
