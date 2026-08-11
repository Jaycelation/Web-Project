'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage, browserApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';
import { EmptyState, LoadingState } from './loading-state';
import { LockIcon } from './icons';

interface Quote { subtotal: number; discount: number; shippingFee: number; total: number }
const COUPON_KEY = 'secure-commerce-coupon-v1';

export function CartView() {
  const { items, subtotal, hydrated, updateQuantity, removeItem } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [message, setMessage] = useState('');
  const payloadItems = useMemo(() => items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })), [items]);

  useEffect(() => {
    const stored = localStorage.getItem(COUPON_KEY) ?? '';
    setCoupon(stored);
    setCouponInput(stored);
  }, []);

  useEffect(() => {
    if (!hydrated || payloadItems.length === 0) { setQuote(null); return; }
    const timer = window.setTimeout(async () => {
      setLoadingQuote(true);
      try {
        const result = await browserApi().request<Quote>('/checkout/quote', { items: payloadItems, ...(coupon ? { couponCode: coupon } : {}) });
        setQuote(result);
        setMessage('');
      } catch (error) {
        setQuote({ subtotal, discount: 0, shippingFee: subtotal >= 1_000_000 ? 0 : 30_000, total: subtotal + (subtotal >= 1_000_000 ? 0 : 30_000) });
        setMessage(apiErrorMessage(error));
      } finally { setLoadingQuote(false); }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [coupon, hydrated, payloadItems, subtotal]);

  const applyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    setCoupon(normalized);
    if (normalized) localStorage.setItem(COUPON_KEY, normalized); else localStorage.removeItem(COUPON_KEY);
  };

  if (!hydrated) return <LoadingState label="Đang mở giỏ hàng…" />;
  if (items.length === 0) return <EmptyState title="Giỏ hàng đang trống" message="Khám phá sản phẩm và chọn biến thể phù hợp trước khi thanh toán." />;
  const totals = quote ?? { subtotal, discount: 0, shippingFee: subtotal >= 1_000_000 ? 0 : 30_000, total: subtotal + (subtotal >= 1_000_000 ? 0 : 30_000) };

  return <div className="cart-layout">
    <div className="cart-panel">
      <div className="cart-panel-head"><h2>{items.length} dòng sản phẩm</h2><Link className="link-button" href="/san-pham">Tiếp tục mua sắm</Link></div>
      {items.map((item) => <div className="cart-line" key={item.variantId}>
        <Image className="cart-line-image" src={item.imageUrl} alt={item.productName} width={120} height={100} />
        <div className="cart-line-info"><h3><Link href={`/san-pham/${item.productSlug}`}>{item.productName}</Link></h3><p>{item.variantName} · SKU {item.sku}</p><button type="button" onClick={() => removeItem(item.variantId)}>Xóa khỏi giỏ</button></div>
        <div className="quantity-control"><button type="button" aria-label="Giảm" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label="Tăng" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>+</button></div>
        <div className="cart-line-price"><strong>{formatMoney(item.unitPrice * item.quantity)}</strong><small>{formatMoney(item.unitPrice)} / sản phẩm</small></div>
      </div>)}
    </div>
    <aside className="summary-card">
      <h2>Tóm tắt đơn hàng</h2>
      <div className="summary-row"><span>Tạm tính</span><strong>{formatMoney(totals.subtotal)}</strong></div>
      <div className="summary-row"><span>Giảm giá</span><strong>−{formatMoney(totals.discount)}</strong></div>
      <div className="summary-row"><span>Phí vận chuyển</span><strong>{totals.shippingFee ? formatMoney(totals.shippingFee) : 'Miễn phí'}</strong></div>
      <div className="coupon-box"><input aria-label="Mã giảm giá" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="WELCOME10" /><button type="button" onClick={applyCoupon}>Áp dụng</button></div>
      {message && <div className="alert alert-error">{message}</div>}
      {coupon && !message && <div className="alert alert-success">Mã {coupon} đã được server xác minh.</div>}
      <div className="summary-row summary-total"><span>Tổng dự kiến</span><strong>{loadingQuote ? '…' : formatMoney(totals.total)}</strong></div>
      <Link className="button button-primary button-block" href="/thanh-toan">Tiến hành thanh toán</Link>
      <p className="summary-note"><LockIcon /> Tổng cuối cùng được API tính lại trong transaction ngay trước khi tạo đơn.</p>
    </aside>
  </div>;
}
