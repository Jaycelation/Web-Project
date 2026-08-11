import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin-dashboard';
import { AdminShell } from '@/components/admin-shell';
export const metadata: Metadata = { title: 'Dashboard quản trị', robots: { index: false, follow: false } };
export default function AdminPage() { return <AdminShell><AdminDashboard /></AdminShell>; }
