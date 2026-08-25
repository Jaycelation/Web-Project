'use client';

import type { OrderDto, OrderStatus } from '@secure-commerce/contracts';
import { useEffect, useState } from 'react';
import { apiErrorMessage, browserRequest } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { orderStatusLabel } from '@/lib/status';

const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = { PENDING_CONFIRMATION: ['CONFIRMED','CANCELLED'], CONFIRMED: ['PREPARING','CANCELLED'], PREPARING: ['SHIPPING','CANCELLED'], SHIPPING: ['DELIVERED','RETURN_REQUESTED'], DELIVERED: ['RETURN_REQUESTED'], RETURN_REQUESTED: ['REFUNDED','DELIVERED'] };

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderDto[]>([]); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = async () => { try { const result = await browserRequest<{items:OrderDto[]}>('/admin/orders', { page: 1, pageSize: 100, ...(status ? { status } : {}) }); setOrders(result.items); } catch (requestError) { setError(apiErrorMessage(requestError)); } };
  useEffect(() => { void load(); }, [status]);
  const update = async (order: OrderDto, target: OrderStatus) => { const note = prompt(`Ghi chú chuyển sang “${orderStatusLabel[target]}”:`, 'Cập nhật bởi quản trị viên') ?? ''; const payload: Record<string, unknown> = { orderId: order.orderId, status: target, ...(note ? { note } : {}) }; if (target === 'SHIPPING') { const trackingCode = prompt('Mã vận đơn:', '') ?? ''; const carrier = prompt('Đơn vị vận chuyển:', 'Giao hàng nội bộ') ?? ''; Object.assign(payload, { trackingCode, carrier }); } try { await browserRequest('/admin/orders/update-status', payload); setMessage(`Đã cập nhật ${order.orderNo}.`); await load(); } catch (requestError) { setError(apiErrorMessage(requestError)); } };
  return <><div className="admin-heading"><div><h1>Quản lý đơn hàng</h1><p>Xác nhận, chuẩn bị, giao, hủy và hoàn tiền theo state machine.</p></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(orderStatusLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>{error && <div className="alert alert-error">{error}</div>}{message && <div className="alert alert-success">{message}</div>}<section className="admin-card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Đơn</th><th>Khách hàng</th><th>Trạng thái</th><th>Tổng tiền</th><th>Thao tác tiếp theo</th></tr></thead><tbody>{orders.map((order) => <tr key={order.orderId}><td><strong>{order.orderNo}</strong><br/><small>{formatDateTime(order.createdAt)}</small></td><td>{order.shippingAddress.fullName}<br/><small>{order.shippingAddress.email}</small></td><td><span className="status-badge" data-status={order.status}>{orderStatusLabel[order.status]}</span></td><td>{formatMoney(order.total)}</td><td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(transitions[order.status] ?? []).map((target) => <button key={target} type="button" className={`button button-sm ${target === 'CANCELLED' ? 'button-danger' : 'button-outline'}`} onClick={() => void update(order, target)}>{orderStatusLabel[target]}</button>)}</div></td></tr>)}</tbody></table></div></section></>;
}
