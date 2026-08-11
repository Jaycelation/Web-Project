'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage, browserApi } from '@/lib/api';
import { useAuth } from './auth-provider';

export function AccountSecurity() {
  const router = useRouter(); const { refreshMe } = useAuth(); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (form.get('newPassword') !== form.get('confirmPassword')) { setError('Mật khẩu xác nhận không khớp.'); return; } setLoading(true); setError(''); try { await browserApi().request('/account/password/change', { currentPassword: String(form.get('currentPassword')), newPassword: String(form.get('newPassword')) }); await refreshMe(); router.replace('/dang-nhap'); } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); } };
  return <section className="account-card"><div className="account-card-head"><h2>Đổi mật khẩu</h2></div><div className="alert alert-info">Sau khi đổi mật khẩu, toàn bộ phiên đăng nhập hiện tại sẽ bị thu hồi.</div><form className="form-grid" onSubmit={submit}><div className="form-field full"><label>Mật khẩu hiện tại</label><input name="currentPassword" type="password" required autoComplete="current-password" /></div><div className="form-field"><label>Mật khẩu mới</label><input name="newPassword" type="password" minLength={10} required autoComplete="new-password" /></div><div className="form-field"><label>Xác nhận</label><input name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" /></div>{error && <div className="form-field full alert alert-error">{error}</div>}<div className="form-field full"><button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Đang cập nhật…' : 'Đổi mật khẩu và đăng xuất'}</button></div></form></section>;
}
