import type { Metadata } from 'next';
import { AccountSecurity } from '@/components/account-security';
import { AccountShell } from '@/components/account-shell';
export const metadata: Metadata = { title: 'Bảo mật tài khoản', robots: { index: false, follow: false } };
export default function SecurityPage() { return <section className="section"><div className="container"><AccountShell><AccountSecurity /></AccountShell></div></section>; }
