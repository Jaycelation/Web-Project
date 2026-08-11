import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderTracker } from '@/components/order-tracker';
export const metadata: Metadata = { title: 'Tra cứu đơn hàng', description: 'Tra cứu trạng thái đơn bằng mã đơn và email đặt hàng.' };
export default function TrackPage() { return <><section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>Tra cứu đơn hàng</strong></div><h1>Đơn hàng đang ở đâu?</h1><p>Khách mua nhanh có thể xem trạng thái mà không cần tạo tài khoản.</p></div></section><section className="section"><div className="container"><OrderTracker /></div></section></>; }
