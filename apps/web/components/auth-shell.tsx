import type { ReactNode } from 'react';
import { LockIcon, ShieldIcon } from './icons';

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="auth-section"><div className="auth-shell"><aside className="auth-aside"><span className="eyebrow eyebrow-light">Secure account</span><h1>Tài khoản của bạn, phiên của bạn.</h1><p>Access token lưu trong cookie HttpOnly; refresh token được xoay vòng và có thể thu hồi theo session.</p><div className="auth-feature"><ShieldIcon /> Mật khẩu băm Argon2id</div><div className="auth-feature"><LockIcon /> CSRF double-submit cho thao tác ghi</div></aside><div className="auth-form"><h2>{title}</h2><p>{description}</p>{children}</div></div></section>;
}
