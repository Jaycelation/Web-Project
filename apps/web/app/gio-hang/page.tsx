import type { Metadata } from 'next';
import Link from 'next/link';
import { CartView } from '@/components/cart-view';

export const metadata: Metadata = { title: 'Giỏ hàng', description: 'Kiểm tra sản phẩm, số lượng, mã giảm giá và tổng tiền dự kiến.' };

export default function CartPage() {
  return <><section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>Giỏ hàng</strong></div><h1>Giỏ hàng của bạn</h1><p>Kiểm tra sản phẩm, số lượng và ưu đãi trước khi thanh toán.</p></div></section><section className="section"><div className="container"><CartView /></div></section></>;
}
