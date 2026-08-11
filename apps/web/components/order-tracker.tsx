'use client';

import type { OrderDto } from '@secure-commerce/contracts';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage, browserApi } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/status';
import { PackageIcon } from './icons';

export function OrderTracker() {
  const [order, setOrder] = useState<OrderDto | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); setError(''); setOrder(null); try { setOrder(await browserApi().request('/orders/track', { orderNo: String(form.get('orderNo')).trim().toUpperCase(), email: String(form.get('email')).trim().toLowerCase() })); } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); } };
  return <div style={{ maxWidth: 860, margin: '0 auto' }}>
    <section className="account-card"><div className="panel-title"><span><PackageIcon style={{ width: 17 }} /></span><h2>Nhập thông tin đơn hàng</h2></div><form className="form-grid" onSubmit={submit}><div className="form-field"><label>Mã đơn</label><input name="orderNo" required placeholder="SC20260811-…" /></div><div className="form-field"><label>Email đặt hàng</label><input name="email" type="email" required /></div><div className="form-field full"><button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Đang tra cứu…' : 'Tra cứu đơn hàng'}</button></div></form>{error && <div className="alert alert-error">{error}</div>}</section>
    {order && <section className="account-card" style={{ marginTop: 20 }}><div className="account-card-head"><div><h2>#{order.orderNo}</h2><small>{formatDateTime(order.createdAt)}</small></div><span className="status-badge" data-status={order.status}>{orderStatusLabel[order.status]}</span></div><div className="summary-row"><span>Thanh toán</span><strong>{paymentStatusLabel[order.paymentStatus]}</strong></div><div className="summary-row"><span>Tổng tiền</span><strong>{formatMoney(order.total)}</strong></div>{order.trackingCode && <div className="alert alert-info">Mã vận đơn: <strong>{order.trackingCode}</strong>{order.trackingUrl && <> · <a href={order.trackingUrl} target="_blank" rel="noreferrer"><strong>Theo dõi vận chuyển</strong></a></>}</div>}<h3>Sản phẩm</h3>{order.items.map((item) => <div className="cart-line" style={{ paddingInline: 0 }} key={item.id}><Image className="cart-line-image" src={item.imageUrl} alt={item.productName} width={96} height={82} /><div className="cart-line-info"><h3>{item.productName}</h3><p>{item.variantName} · {item.sku}</p></div><div /><div className="cart-line-price"><strong>{formatMoney(item.lineTotal)}</strong><small>× {item.quantity}</small></div></div>)}<h3>Tiến trình xử lý</h3><div className="timeline">{order.statusHistory.map((item) => <div className="timeline-item" key={item.id}><strong>{orderStatusLabel[item.toStatus]}</strong>{item.note && <p>{item.note}</p>}<time>{formatDateTime(item.createdAt)}</time></div>)}</div></section>}
  </div>;
}
