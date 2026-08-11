'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { apiErrorMessage, browserApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAuth } from './auth-provider';
import { LoadingState } from './loading-state';

interface Address { id: string; label: string; fullName: string; phone: string; line1: string; line2: string | null; ward: string | null; district: string; province: string; postalCode: string | null; country: string; isDefault: boolean }
interface Overview { id: string; name: string; email: string; phone: string | null; role: string; createdAt: string; addresses: Address[]; _count: { orders: number } }

export function AccountOverview() {
  const { refreshMe } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => { setLoading(true); try { setData(await browserApi().request('/account/overview', {})); } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError('');
    try { await browserApi().request('/account/profile/update', { name: String(form.get('name')), phone: String(form.get('phone') ?? '') || undefined }); setMessage('Đã cập nhật hồ sơ.'); await Promise.all([load(), refreshMe()]); } catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError('');
    try { await browserApi().request('/account/addresses/save', { label: String(form.get('label')), fullName: String(form.get('fullName')), phone: String(form.get('phone')), line1: String(form.get('line1')), ward: String(form.get('ward') ?? '') || undefined, district: String(form.get('district')), province: String(form.get('province')), country: 'VN', isDefault: form.get('isDefault') === 'on' }); event.currentTarget.reset(); setMessage('Đã lưu địa chỉ.'); await load(); } catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const removeAddress = async (addressId: string) => { if (!confirm('Xóa địa chỉ này?')) return; try { await browserApi().request('/account/addresses/delete', { addressId }); await load(); } catch (requestError) { setError(apiErrorMessage(requestError)); } };

  if (loading && !data) return <LoadingState />;
  if (!data) return <div className="alert alert-error">{error || 'Không tải được tài khoản.'}</div>;
  return <>
    <div className="metric-grid"><div className="metric-card"><small>Đơn hàng đã tạo</small><strong>{data._count.orders}</strong></div><div className="metric-card"><small>Địa chỉ đã lưu</small><strong>{data.addresses.length}</strong></div><div className="metric-card"><small>Thành viên từ</small><strong style={{ fontSize: 16 }}>{formatDateTime(data.createdAt)}</strong></div></div>
    {message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-error">{error}</div>}
    <section className="account-card"><div className="account-card-head"><h2>Thông tin cá nhân</h2></div><form className="form-grid" onSubmit={updateProfile}><div className="form-field"><label htmlFor="name">Họ và tên</label><input id="name" name="name" defaultValue={data.name} required /></div><div className="form-field"><label htmlFor="phone">Số điện thoại</label><input id="phone" name="phone" defaultValue={data.phone ?? ''} pattern="(?:\+?84|0)[0-9]{9,10}" /></div><div className="form-field full"><label>Email</label><input value={data.email} disabled /><span className="form-hint">Thay đổi email cần quy trình xác minh riêng.</span></div><div className="form-field full"><button className="button button-primary" type="submit">Lưu hồ sơ</button></div></form></section>
    <section className="account-card"><div className="account-card-head"><h2>Địa chỉ nhận hàng</h2></div><div className="order-list">{data.addresses.map((address) => <div className="order-card" key={address.id}><div className="order-card-head"><div><h3>{address.label} {address.isDefault && <span className="status-badge" data-status="DELIVERED">Mặc định</span>}</h3><small>{address.fullName} · {address.phone}</small><p style={{ fontSize: 12, marginBottom: 0 }}>{[address.line1, address.ward, address.district, address.province].filter(Boolean).join(', ')}</p></div><button className="button button-danger button-sm" type="button" onClick={() => void removeAddress(address.id)}>Xóa</button></div></div>)}</div><h3 style={{ marginTop: 28 }}>Thêm địa chỉ</h3><form className="form-grid" onSubmit={saveAddress}><div className="form-field"><label>Nhãn địa chỉ</label><input name="label" required placeholder="Nhà riêng" /></div><div className="form-field"><label>Người nhận</label><input name="fullName" required defaultValue={data.name} /></div><div className="form-field"><label>Số điện thoại</label><input name="phone" required defaultValue={data.phone ?? ''} pattern="(?:\+?84|0)[0-9]{9,10}" /></div><div className="form-field"><label>Địa chỉ</label><input name="line1" required /></div><div className="form-field"><label>Phường / xã</label><input name="ward" /></div><div className="form-field"><label>Quận / huyện</label><input name="district" required /></div><div className="form-field"><label>Tỉnh / thành</label><input name="province" required /></div><div className="form-field" style={{ alignContent: 'end' }}><label className="filter-option"><input type="checkbox" name="isDefault" /> Đặt làm mặc định</label></div><div className="form-field full"><button className="button button-dark" type="submit">Thêm địa chỉ</button></div></form></section>
  </>;
}
