import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountOverview } from '@/components/account-overview';
import { AccountShell } from '@/components/account-shell';
export const metadata: Metadata = { title: 'Tài khoản', robots: { index: false, follow: false } };
export default function AccountPage() { return <><section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>Tài khoản</strong></div><h1>Khu vực khách hàng</h1></div></section><section className="section"><div className="container"><AccountShell><AccountOverview /></AccountShell></div></section></>; }
