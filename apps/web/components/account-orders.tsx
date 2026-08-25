'use client';

import type { OrderDto } from '@secure-commerce/contracts';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { apiErrorMessage, browserRequest, clientOrders } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/status';
import { LoadingState, EmptyState } from './loading-state';

export function AccountOrders() {
  const [orders, setOrders] = useState<OrderDto[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { setOrders((await clientOrders()).items); } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const act = async (path: string, orderId: string, promptText: string) => { const reason = prompt(promptText); if (!reason) return; try { await browserRequest(path, { orderId, reason }); await load(); } catch (requestError) { setError(apiErrorMessage(requestError)); } };
  if (loading) return <LoadingState label="Đang tải lịch sử đơn…" />;
  if (!orders.length) return <EmptyState title="Bạn chưa có đơn hàng" message="Khi đặt hàng bằng tài khoản, lịch sử và trạng thái sẽ xuất hiện tại đây." />;
  return <section className="account-card"><div className="account-card-head"><h2>Lịch sử đơn hàng</h2><span>{orders.length} đơn</span></div>{error && <div className="alert alert-error">{error}</div>}<div className="order-list">{orders.map((order) => <article className="order-card" key={order.orderId}><div className="order-card-head"><div><h3>#{order.orderNo}</h3><small>{formatDateTime(order.createdAt)} · {paymentStatusLabel[order.paymentStatus]}</small></div><span className="status-badge" data-status={order.status}>{orderStatusLabel[order.status]}</span></div><details style={{ marginTop: 15 }}><summary className="link-button" style={{ cursor: 'pointer' }}>Xem chi tiết</summary><div style={{ marginTop: 18 }}>{order.items.map((item) => <div className="cart-line" style={{ paddingInline: 0 }} key={item.id}><Image className="cart-line-image" src={item.imageUrl} alt={item.productName} width={90} height={75} /><div className="cart-line-info"><h3>{item.productName}</h3><p>{item.variantName} · {item.sku}</p></div><div /><div className="cart-line-price"><strong>{formatMoney(item.lineTotal)}</strong><small>× {item.quantity}</small></div></div>)}<h4>Tiến trình</h4><div className="timeline">{order.statusHistory.map((item) => <div className="timeline-item" key={item.id}><strong>{orderStatusLabel[item.toStatus]}</strong>{item.note && <p>{item.note}</p>}<time>{formatDateTime(item.createdAt)}{item.actorName ? ` · ${item.actorName}` : ''}</time></div>)}</div></div></details><div className="order-card-foot"><div><small>Tổng thanh toán</small><strong style={{ display: 'block' }}>{formatMoney(order.total)}</strong></div><div style={{ display: 'flex', gap: 8 }}>{order.status === 'PENDING_CONFIRMATION' && <button className="button button-danger button-sm" type="button" onClick={() => void act('/orders/cancel', order.orderId, 'Lý do hủy đơn:')}>Hủy đơn</button>}{order.status === 'DELIVERED' && <button className="button button-outline button-sm" type="button" onClick={() => void act('/orders/request-return', order.orderId, 'Mô tả yêu cầu đổi trả:')}>Yêu cầu đổi trả</button>}</div></div></article>)}</div></section>;
}
