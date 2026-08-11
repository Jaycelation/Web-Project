'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage, browserApi } from '@/lib/api';

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (data.get('password') !== data.get('confirmPassword')) { setError('Mật khẩu xác nhận không khớp.'); return; } setLoading(true); setError(''); try { await browserApi().request('/auth/reset-password', { token, password: String(data.get('password')) }); setSuccess(true); } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); } };
  if (!token) return <div className="alert alert-error">Liên kết thiếu reset token.</div>;
  if (success) return <div className="alert alert-success">Đã đổi mật khẩu. <Link href="/dang-nhap"><strong>Đăng nhập ngay</strong></Link>.</div>;
  return <form onSubmit={submit}><div className="form-field"><label htmlFor="password">Mật khẩu mới</label><input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /></div><div className="form-field"><label htmlFor="confirmPassword">Xác nhận mật khẩu</label><input id="confirmPassword" name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" /></div>{error && <div className="alert alert-error">{error}</div>}<button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button></form>;
}
