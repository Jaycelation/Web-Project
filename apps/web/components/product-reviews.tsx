'use client';
import type { ReviewEligibilityDto, ReviewListResult } from '@secure-commerce/contracts';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from './auth-provider';
import { usePagedResource } from '@/lib/use-paged-resource';
import { apiErrorMessage, browserRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { LoadingState } from './loading-state';
import { Pagination } from './pagination';
export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth(); const [page, setPage] = useState(1);
  const listing = usePagedResource<ReviewListResult>('/reviews/list', { productId, page, pageSize: 5 });
  const eligibility = usePagedResource<{ items: ReviewEligibilityDto[] }>('/reviews/eligible', { productId }, Boolean(user), user?.id ?? '');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setError(''); setMessage('');
    try {
      await browserRequest('/reviews/create', { orderItemId: fields.get('orderItemId'), rating: Number(fields.get('rating')), comment: String(fields.get('comment')).trim() });
      form.reset(); setMessage('Đánh giá đã gửi và đang chờ duyệt.'); eligibility.reload();
    } catch (cause) { setError(apiErrorMessage(cause)); } finally { setBusy(false); }
  };
  const data = listing.data;
  return <section id="danh-gia" className="section-sm"><div className="container"><div className="review-layout">
    <div><span className="eyebrow">Trải nghiệm thực tế</span><h2>Đánh giá từ khách hàng</h2>
      {data && <div className="review-summary"><strong>{data.summary.average ?? '—'}<small> / 5</small></strong><p>{data.summary.count} đánh giá đã duyệt</p>
        {[5,4,3,2,1].map((rating) => <div className="rating-row" key={rating}><span>{rating} ★</span><progress max={Math.max(1,data.summary.count)} value={data.summary.distribution[rating] ?? 0} aria-label={`${rating} sao`} /><span>{data.summary.distribution[rating] ?? 0}</span></div>)}
      </div>}
      {!user ? <p><Link className="link-button" href="/dang-nhap">Đăng nhập</Link> để đánh giá đơn hàng đã giao.</p> : <>
        {eligibility.error && <p role="alert">{eligibility.error}</p>}
        {eligibility.data?.items.length ? <form onSubmit={submit} className="review-form">
          <label>Đơn đã nhận<select name="orderItemId" required>{eligibility.data.items.map((item) => <option value={item.orderItemId} key={item.orderItemId}>{item.orderNo} — {item.variantName}</option>)}</select></label>
          <label>Mức độ hài lòng<select name="rating" defaultValue="5">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} sao</option>)}</select></label>
          <label>Nội dung<textarea name="comment" minLength={3} maxLength={3000} required rows={4} placeholder="Chia sẻ trải nghiệm, không ghi thông tin cá nhân." /></label>
          <button className="button button-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
        </form> : eligibility.data && <p>Chưa có đơn đã giao chưa đánh giá. Mỗi sản phẩm trong đơn được gửi một lần.</p>}
      </>}
      {message && <div className="alert alert-success" role="status">{message}</div>}{error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
    <div>{listing.error && <div className="alert alert-error" role="alert">{listing.error} <button className="link-button" onClick={listing.reload} type="button">Thử lại</button></div>}
      {listing.loading && <LoadingState />}{data && !data.total && <p>Chưa có đánh giá. Không hiển thị điểm mẫu.</p>}
      {data?.items.map((review) => <article className="review-card" key={review.id}><header><strong>{review.authorName}</strong><span aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></header>
        <small>{review.verifiedPurchase ? 'Đã mua hàng · ' : ''}{formatDateTime(review.createdAt)}</small><p>{review.comment}</p></article>)}
      {data && <Pagination page={page} pageSize={5} total={data.total} onChange={setPage} disabled={listing.loading} />}
    </div>
  </div></div></section>;
}
