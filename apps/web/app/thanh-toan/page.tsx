import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutView } from '@/components/checkout-view';

export const metadata: Metadata = { title: 'Thanh toán', robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return <><section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><Link href="/gio-hang">Giỏ hàng</Link><span>/</span><strong>Thanh toán</strong></div><h1>Hoàn tất đơn hàng</h1><p>Kiểm tra địa chỉ, phương thức thanh toán và tổng tiền trước khi đặt.</p></div></section><section className="section"><div className="container"><CheckoutView /></div></section></>;
}
