'use client';
import type { OrderDto, OrderStatus } from '@secure-commerce/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage, browserRequest } from '@/lib/api';
import { usePagedResource } from '@/lib/use-paged-resource';
import { formatDateTime, formatMoney } from '@/lib/format';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/status';
import { useAuth } from './auth-provider';
import { AdminSearch, ResourceStatus } from './admin-list-tools';
import { Pagination } from './pagination';
const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPING', 'CANCELLED'], SHIPPING: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'], RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
};
type Action = { order: OrderDto; target: OrderStatus | 'CONFIRM_TRANSFER' };
export function AdminOrders() {
  const { user } = useAuth();
  const [page, setPage] = useState(1), [status, setStatus] = useState(''), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const filters = { page, pageSize: 20, ...(status ? { status } : {}), ...(query ? { query } : {}) };
  const resource = usePagedResource<{ items: OrderDto[]; total: number }>('/admin/orders', filters);
  useEffect(() => { if (action) dialog.current?.showModal(); else dialog.current?.close(); }, [action]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!action || busy) return;
    const data = new FormData(event.currentTarget); setBusy(true); setError(''); setMessage('');
    try {
      if (action.target === 'CONFIRM_TRANSFER') {
        await browserRequest('/admin/payments/confirm-transfer', {
          orderId: action.order.orderId, providerRef: String(data.get('reference') ?? '').trim(),
          expectedTotal: Number(data.get('amount')),
        });
      } else {
        await browserRequest('/admin/orders/update-status', {
          orderId: action.order.orderId, status: action.target,
          note: String(data.get('note') ?? '').trim(),
          ...(action.target === 'SHIPPING' ? {
            trackingCode: String(data.get('trackingCode') ?? '').trim(),
            carrier: String(data.get('carrier') ?? '').trim(),
          } : {}),
        });
      }
      setMessage(`Đã cập nhật ${action.order.orderNo}.`); setAction(null); resource.reload();
    } catch (cause) { setError(apiErrorMessage(cause)); } finally { setBusy(false); }
  };
  const exportCsv = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await browserRequest<{ filename: string; csv: string; count: number; total: number; truncated: boolean }>('/admin/orders/export', filters);
      const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = result.filename;
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Đã xuất ${result.count}/${result.total} đơn, không kèm thông tin cá nhân.${result.truncated ? ' Giới hạn 250 đơn mới nhất; hãy thu hẹp bộ lọc.' : ''}`);
    } catch (cause) { setError(apiErrorMessage(cause)); } finally { setBusy(false); }
  };
  return <>
    <div className="admin-heading"><div><h1>Quản lý đơn hàng</h1><p>Lọc, phân trang, xuất CSV và đối soát thủ công.</p></div>
      <button type="button" className="button button-outline" disabled={busy} onClick={() => void exportCsv()}>Xuất CSV</button></div>
    <div className="inline-actions"><AdminSearch placeholder="Mã đơn, email, số điện thoại" onSearch={(q) => { setQuery(q); setPage(1); }}/>
      <select aria-label="Trạng thái đơn hàng" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(orderStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
    <ResourceStatus loading={resource.loading} error={resource.error} retry={resource.reload}/>
    {error && !action && <div className="alert alert-error" role="alert">{error}</div>}{message && <div className="alert alert-success" role="status">{message}</div>}
    <section className="admin-card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Đơn</th><th>Khách hàng</th><th>Trạng thái</th><th>Thanh toán</th><th>Tổng tiền</th><th>Thao tác</th></tr></thead><tbody>
      {resource.data?.items.map((order) => <tr key={order.orderId}><td><strong>{order.orderNo}</strong><br/><small>{formatDateTime(order.createdAt)}</small></td><td>{order.shippingAddress.fullName}<br/><small>{order.shippingAddress.email}</small></td>
        <td><span className="status-badge" data-status={order.status}>{orderStatusLabel[order.status]}</span></td><td>{order.paymentMethod}<br/>{paymentStatusLabel[order.paymentStatus]}</td><td>{formatMoney(order.total)}</td>
        <td><div className="inline-actions">{(transitions[order.status] ?? []).map((target) => <button type="button" className="button button-outline button-sm" key={target} disabled={busy} onClick={() => { setError(''); setAction({ order, target }); }}>{orderStatusLabel[target]}</button>)}
          {user?.role === 'ADMIN' && order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'AWAITING_TRANSFER' && !['CANCELLED', 'RETURN_REQUESTED', 'REFUNDED'].includes(order.status) && <button type="button" className="button button-primary button-sm" disabled={busy} onClick={() => { setError(''); setAction({ order, target: 'CONFIRM_TRANSFER' }); }}>Đối soát chuyển khoản</button>}
        </div></td></tr>)}
      {resource.data?.items.length === 0 && <tr><td colSpan={6}>Không có đơn phù hợp.</td></tr>}
    </tbody></table></div></section>
    <Pagination page={page} pageSize={20} total={resource.data?.total ?? 0} disabled={resource.loading} onChange={setPage}/>
    <dialog ref={dialog} className="upgrade-dialog" aria-labelledby="order-action-title" onCancel={(e) => { e.preventDefault(); if (!busy) setAction(null); }}>
      {action && <form key={`${action.order.orderId}-${action.target}`} className="upgrade-form" onSubmit={submit}><h2 id="order-action-title">{action.target === 'CONFIRM_TRANSFER' ? 'Đối soát chuyển khoản' : orderStatusLabel[action.target]}</h2><p>Đơn {action.order.orderNo} · {formatMoney(action.order.total)}</p>
        {action.target === 'REFUNDED' && <p className="alert">Thao tác chỉ ghi nhận trạng thái. Chỉ xác nhận sau khi đã hoàn tiền thực tế; hệ thống không tự chuyển tiền.</p>}
        {action.target === 'CANCELLED' && action.order.paymentStatus === 'PAID' && <p className="alert">Đơn đã thanh toán. Hủy đơn không tự hoàn tiền; cần đối soát riêng.</p>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <fieldset disabled={busy}>{action.target === 'CONFIRM_TRANSFER' ? <>
          <p className="alert">Chỉ xác nhận sau khi đã kiểm tra giao dịch thực tế trên ngân hàng. Đây không phải xác minh tự động.</p>
          <label>Mã tham chiếu ngân hàng<input name="reference" required minLength={3} maxLength={120}/></label>
          <label>Số tiền thực nhận (VND)<input name="amount" type="number" min={0} max={2147483647} step={1} required/></label>
          <label className="filter-option"><input type="checkbox" required/>Tôi đã đối chiếu đúng đơn và đủ số tiền.</label>
        </> : <><label>Ghi chú<textarea name="note" required minLength={3} maxLength={500} rows={3}/></label>{action.target === 'SHIPPING' && <><label>Đơn vị vận chuyển<input name="carrier" required maxLength={100}/></label><label>Mã vận đơn<input name="trackingCode" required maxLength={120}/></label></>}</>}
          <div className="inline-actions"><button className="button button-primary" type="submit">{busy ? 'Đang lưu…' : 'Xác nhận'}</button><button type="button" className="button button-outline" onClick={() => setAction(null)}>Quay lại</button></div>
        </fieldset></form>}
    </dialog>
  </>;
}
