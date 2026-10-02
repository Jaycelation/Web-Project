'use client';
import type { AdminReviewDto, PageResult } from '@secure-commerce/contracts';
import { useState } from 'react';
import Link from 'next/link';
import { usePagedResource } from '@/lib/use-paged-resource';
import { apiErrorMessage, browserRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Pagination } from './pagination';
import { AdminSearch, ResourceStatus } from './admin-list-tools';
export function AdminReviews(){
  const [page,setPage]=useState(1),[query,setQuery]=useState(''),[status,setStatus]=useState('PENDING');
  const resource=usePagedResource<PageResult<AdminReviewDto>>('/admin/reviews',{page,pageSize:20,...(status?{status}:{}),...(query?{query}:{})});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const moderate=async(reviewId:string,next:'APPROVED'|'HIDDEN')=>{
    setBusy(true);setError('');try{await browserRequest('/admin/reviews/moderate',{reviewId,status:next});resource.reload();}
    catch(cause){setError(apiErrorMessage(cause));}finally{setBusy(false);}
  };
  return <><div className="admin-heading"><div><h1>Duyệt đánh giá</h1><p>Chỉ công khai đánh giá đã duyệt. Không chỉnh sửa nội dung của khách.</p></div>
    <select aria-label="Lọc trạng thái" value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="HIDDEN">Đã ẩn</option><option value="">Tất cả</option></select></div>
    <AdminSearch onSearch={(q)=>{setQuery(q);setPage(1);}} placeholder="Tên sản phẩm"/>
    {error&&<div className="alert alert-error" role="alert">{error}</div>}<ResourceStatus error={resource.error} loading={resource.loading} retry={resource.reload}/>
    {resource.data&&<section className="admin-card">{!resource.data.items.length&&<p>Không có đánh giá trong bộ lọc này.</p>}{resource.data.items.map((review)=><article className="review-card" key={review.id}>
      <header><Link href={`/san-pham/${review.product.slug}`}><strong>{review.product.name}</strong></Link><span>{review.rating}/5 · {review.status}</span></header>
      <small>{review.user.name} · {formatDateTime(review.createdAt)}</small><p>{review.comment}</p><div className="inline-actions">
        {review.status!=='APPROVED'&&<button className="button button-primary button-sm" disabled={busy} onClick={()=>void moderate(review.id,'APPROVED')} type="button">Duyệt</button>}
        {review.status!=='HIDDEN'&&<button className="button button-outline button-sm" disabled={busy} onClick={()=>void moderate(review.id,'HIDDEN')} type="button">Ẩn</button>}
      </div></article>)}<Pagination page={page} pageSize={20} total={resource.data.total} onChange={setPage}/></section>}
  </>;
}
