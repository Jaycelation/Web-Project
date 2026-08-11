'use client';

import type { CheckoutResult } from '@secure-commerce/contracts';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage, browserApi, clientCheckout } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from './auth-provider';
import { useCart } from './cart-provider';
import { EmptyState, LoadingState } from './loading-state';
import { LockIcon, ShieldIcon } from './icons';

interface Quote { subtotal: number; discount: number; shippingFee: number; total: number }
const COUPON_KEY = 'secure-commerce-coupon-v1';

export function CheckoutView() {
  const { user } = useAuth();
  const { items, subtotal, hydrated, guestSessionId, clear } = useCart();
  const [coupon, setCoupon] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>('COD');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const idempotencyKey = useRef('');
  const lines = useMemo(() => items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })), [items]);

  useEffect(() => {
    setCoupon(localStorage.getItem(COUPON_KEY) ?? '');
    idempotencyKey.current ||= `checkout:${crypto.randomUUID()}`;
  }, []);

  useEffect(() => {
    if (!hydrated || !lines.length) return;
    void browserApi().request<Quote>('/checkout/quote', { items: lines, ...(coupon ? { couponCode: coupon } : {}) })
      .then(setQuote)
      .catch(() => setQuote({ subtotal, discount: 0, shippingFee: subtotal >= 1_000_000 ? 0 : 30_000, total: subtotal + (subtotal >= 1_000_000 ? 0 : 30_000) }));
  }, [coupon, hydrated, lines, subtotal]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    try {
      const order = await clientCheckout({
        items: lines,
        shippingAddress: {
          fullName: String(data.get('fullName') ?? ''),
          phone: String(data.get('phone') ?? ''),
          email: String(data.get('email') ?? ''),
          line1: String(data.get('line1') ?? ''),
          line2: String(data.get('line2') ?? '') || undefined,
          ward: String(data.get('ward') ?? '') || undefined,
          district: String(data.get('district') ?? ''),
          province: String(data.get('province') ?? ''),
          postalCode: String(data.get('postalCode') ?? '') || undefined,
          country: 'VN',
        },
        paymentMethod,
        ...(coupon ? { couponCode: coupon } : {}),
        customerNote: String(data.get('customerNote') ?? '') || undefined,
        ...(!user && guestSessionId ? { guestSessionId } : {}),
      }, idempotencyKey.current);
      setResult(order);
      clear();
      localStorage.removeItem(COUPON_KEY);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally { setLoading(false); }
  };

  if (!hydrated) return <LoadingState label="Đang chuẩn bị checkout…" />;
  if (result) return <OrderSuccess result={result} />;
  if (!items.length) return <EmptyState title="Không có sản phẩm để thanh toán" message="Giỏ hàng đã trống hoặc đơn vừa được tạo thành công." />;
  const totals = quote ?? { subtotal, discount: 0, shippingFee: subtotal >= 1_000_000 ? 0 : 30_000, total: subtotal + (subtotal >= 1_000_000 ? 0 : 30_000) };

  return <form className="checkout-layout" onSubmit={submit}>
    <div>
      <section className="checkout-panel">
        <div className="panel-title"><span>1</span><h2>Thông tin giao hàng</h2></div>
        {!user && <div className="alert alert-info">Bạn đang mua nhanh không cần tài khoản. Có thể dùng email và mã đơn để tra cứu sau.</div>}
        <div className="form-grid">
          <div className="form-field"><label htmlFor="fullName">Họ và tên</label><input id="fullName" name="fullName" required minLength={2} maxLength={100} defaultValue={user?.name ?? ''} autoComplete="name" /></div>
          <div className="form-field"><label htmlFor="phone">Số điện thoại</label><input id="phone" name="phone" required pattern="(?:\+?84|0)[0-9]{9,10}" defaultValue={user?.phone ?? ''} autoComplete="tel" /></div>
          <div className="form-field full"><label htmlFor="email">Email nhận xác nhận</label><input id="email" name="email" type="email" required defaultValue={user?.email ?? ''} autoComplete="email" /></div>
          <div className="form-field full"><label htmlFor="line1">Địa chỉ</label><input id="line1" name="line1" required minLength={3} placeholder="Số nhà, tên đường" autoComplete="street-address" /></div>
          <div className="form-field"><label htmlFor="ward">Phường / xã</label><input id="ward" name="ward" /></div>
          <div className="form-field"><label htmlFor="district">Quận / huyện</label><input id="district" name="district" required /></div>
          <div className="form-field"><label htmlFor="province">Tỉnh / thành phố</label><input id="province" name="province" required /></div>
          <div className="form-field"><label htmlFor="postalCode">Mã bưu chính</label><input id="postalCode" name="postalCode" inputMode="numeric" /></div>
          <div className="form-field full"><label htmlFor="customerNote">Ghi chú đơn hàng</label><textarea id="customerNote" name="customerNote" maxLength={500} placeholder="Thời gian giao phù hợp, chỉ dẫn cho shipper…" /></div>
        </div>
      </section>

      <section className="checkout-panel">
        <div className="panel-title"><span>2</span><h2>Phương thức thanh toán</h2></div>
        <div className="payment-options">
          <label className="payment-option"><input type="radio" name="payment" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} /><span><strong>Thanh toán khi nhận hàng — COD</strong><p>Thanh toán cho nhân viên giao hàng sau khi nhận và kiểm tra kiện hàng.</p></span></label>
          <label className="payment-option"><input type="radio" name="payment" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} /><span><strong>Chuyển khoản ngân hàng</strong><p>Thông tin tài khoản và nội dung chuyển khoản được hiển thị sau khi đặt đơn.</p></span></label>
        </div>
      </section>
    </div>

    <aside className="summary-card">
      <h2>Xác nhận đơn hàng</h2>
      {items.map((item) => <div className="summary-row" key={item.variantId}><span>{item.productName} × {item.quantity}</span><strong>{formatMoney(item.unitPrice * item.quantity)}</strong></div>)}
      <div className="summary-row" style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 16 }}><span>Tạm tính</span><strong>{formatMoney(totals.subtotal)}</strong></div>
      <div className="summary-row"><span>Giảm giá {coupon && `(${coupon})`}</span><strong>−{formatMoney(totals.discount)}</strong></div>
      <div className="summary-row"><span>Vận chuyển</span><strong>{totals.shippingFee ? formatMoney(totals.shippingFee) : 'Miễn phí'}</strong></div>
      <div className="summary-row summary-total"><span>Thanh toán</span><strong>{formatMoney(totals.total)}</strong></div>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? 'Đang tạo đơn an toàn…' : 'Đặt hàng'}</button>
      <p className="summary-note"><ShieldIcon /> Nút có thể bấm lại an toàn: cùng idempotency key chỉ tạo tối đa một đơn.</p>
      <p className="summary-note"><LockIcon /> Payload checkout được bọc bằng AES‑256‑GCM; khóa AES được RSA‑OAEP wrap.</p>
    </aside>
  </form>;
}

function OrderSuccess({ result }: { result: CheckoutResult }) {
  return <div className="account-card" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: 48 }}>
    <div className="empty-orbit" style={{ margin: '0 auto' }} />
    <h1 style={{ fontSize: 38, letterSpacing: '-.04em', marginBottom: 8 }}>Đặt hàng thành công</h1>
    <p style={{ color: 'var(--muted)' }}>Mã đơn của bạn là <strong style={{ color: 'var(--ink)' }}>{result.orderNo}</strong></p>
    <div className="summary-card" style={{ position: 'static', textAlign: 'left', marginTop: 28 }}>
      <div className="summary-row"><span>Trạng thái</span><strong>Chờ xác nhận</strong></div>
      <div className="summary-row"><span>Tổng tiền</span><strong>{formatMoney(result.total)}</strong></div>
      {result.bankTransfer && <div className="alert alert-info"><strong>Thông tin chuyển khoản</strong><br />{result.bankTransfer.bankName}<br />STK: {result.bankTransfer.accountNumber}<br />Chủ tài khoản: {result.bankTransfer.accountName}<br />Nội dung: <strong>{result.bankTransfer.transferContent}</strong></div>}
    </div>
    <div className="hero-actions" style={{ justifyContent: 'center' }}><Link className="button button-primary" href="/tra-cuu-don-hang">Tra cứu đơn</Link><Link className="button button-outline" href="/san-pham">Tiếp tục mua sắm</Link></div>
  </div>;
}
