import type { Metadata } from 'next';
import { AdminProducts } from '@/components/admin-products';
import { AdminShell } from '@/components/admin-shell';
export const metadata: Metadata = { title: 'Quản trị sản phẩm', robots: { index: false, follow: false } };
export default function AdminProductsPage() { return <AdminShell><AdminProducts /></AdminShell>; }
