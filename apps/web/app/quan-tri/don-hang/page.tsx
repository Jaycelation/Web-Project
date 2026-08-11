import type { Metadata } from 'next';
import { AdminOrders } from '@/components/admin-orders';
import { AdminShell } from '@/components/admin-shell';
export const metadata: Metadata = { title: 'Quản trị đơn hàng', robots: { index: false, follow: false } };
export default function AdminOrdersPage() { return <AdminShell><AdminOrders /></AdminShell>; }
