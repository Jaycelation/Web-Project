import type { Metadata } from 'next';
import { AccountOrders } from '@/components/account-orders';
import { AccountShell } from '@/components/account-shell';
export const metadata: Metadata = { title: 'Đơn hàng của tôi', robots: { index: false, follow: false } };
export default function OrdersPage() { return <section className="section"><div className="container"><AccountShell><AccountOrders /></AccountShell></div></section>; }
