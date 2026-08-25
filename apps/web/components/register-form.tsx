'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from './auth-provider';

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmPassword')) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setLoading(true); setError('');
    try {
      const phone = String(data.get('phone') ?? '').trim();
      await register({ name: String(data.get('name')), email: String(data.get('email')), ...(phone ? { phone } : {}), password: String(data.get('password')) });
      router.replace('/tai-khoan');
    } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); }
  };
  return <><form onSubmit={submit}><div className="form-grid"><div className="form-field full"><label htmlFor="name">Họ và tên</label><input id="name" name="name" required minLength={2} autoComplete="name" /></div><div className="form-field full"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div><div className="form-field full"><label htmlFor="phone">Số điện thoại (không bắt buộc)</label><input id="phone" name="phone" pattern="(?:\+?84|0)[0-9]{9,10}" autoComplete="tel" /></div><div className="form-field"><label htmlFor="password">Mật khẩu</label><input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /><span className="form-hint">Ít nhất 10 ký tự, có chữ hoa, chữ thường và số.</span></div><div className="form-field"><label htmlFor="confirmPassword">Xác nhận</label><input id="confirmPassword" name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" /></div></div>{error && <div className="alert alert-error">{error}</div>}<button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button></form><p className="auth-switch">Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></p></>;
}
