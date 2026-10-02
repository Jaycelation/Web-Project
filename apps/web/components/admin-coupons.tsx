'use client';
import type { CouponAdminDto, PageResult } from '@secure-commerce/contracts';
import { useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';
import { usePagedResource } from '@/lib/use-paged-resource';
import { apiErrorMessage, browserRequest } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Pagination } from './pagination';
import { AdminSearch, ResourceStatus } from './admin-list-tools';
export function AdminCoupons() {
  const { user } = useAuth(); const canEdit = user?.role === 'ADMIN';
  const [page,setPage]=useState(1), [query,setQuery]=useState('');
  const resource=usePagedResource<PageResult<CouponAdminDto>>('/admin/coupons',{ page,pageSize:20,...(query ? {query}: {}) });
  const [type,setType]=useState<CouponAdminDto['type']>('PERCENTAGE');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  const create=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget;const fields=new FormData(form);setBusy(true);setError('');setMessage('');
    try {
      await browserRequest('/admin/coupons/create',{
        code:String(fields.get('code')).trim().toUpperCase(),name:fields.get('name'),type,
        value:type==='FREE_SHIPPING'?0:Number(fields.get('value')),minOrder:Number(fields.get('minOrder')),
        maxDiscount:fields.get('maxDiscount')?Number(fields.get('maxDiscount')):null,
        usageLimit:fields.get('usageLimit')?Number(fields.get('usageLimit')):null,
        usagePerUser:Number(fields.get('usagePerUser')),
        startsAt:new Date(String(fields.get('startsAt'))).toISOString(),expiresAt:new Date(String(fields.get('expiresAt'))).toISOString(),
      }); form.reset();setMessage('Đã tạo coupon.');resource.reload();
    }catch(cause){setError(apiErrorMessage(cause));}finally{setBusy(false);}
  };
  const toggle=async(coupon:CouponAdminDto)=>{
    if(!confirm(`${coupon.active?'Tạm dừng':'Bật lại'} mã ${coupon.code}?`))return;
    setBusy(true);setError('');try{await browserRequest('/admin/coupons/status',{couponId:coupon.id,active:!coupon.active});resource.reload();}
    catch(cause){setError(apiErrorMessage(cause));}finally{setBusy(false);}
  };
  return <><div className="admin-heading"><div><h1>Khuyến mãi & coupon</h1><p>Tạo mã có thời hạn, giới hạn lượt dùng; không sửa ngầm điều kiện mã đã phát hành.</p></div></div>
    <AdminSearch onSearch={(q)=>{setQuery(q);setPage(1);}} placeholder="Mã hoặc tên chương trình" />
    {error&&<div className="alert alert-error" role="alert">{error}</div>}{message&&<div className="alert alert-success" role="status">{message}</div>}
    {canEdit&&<details className="admin-card"><summary>Tạo coupon mới</summary><form onSubmit={create}><fieldset disabled={busy} className="form-grid upgrade-form">
      <label>Mã<input name="code" required minLength={3} maxLength={40} placeholder="WELCOME20" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,39}" /></label>
      <label>Tên chương trình<input name="name" required minLength={3} maxLength={120} /></label>
      <label>Loại<select value={type} onChange={(e)=>setType(e.target.value as CouponAdminDto['type'])}><option value="PERCENTAGE">Phần trăm</option><option value="FIXED_AMOUNT">Giảm số tiền</option><option value="FREE_SHIPPING">Miễn phí vận chuyển</option></select></label>
      <label>{type==='PERCENTAGE'?'Phần trăm (%)':'Giá trị (VND)'}<input key={type} name="value" type="number" min={type==='FREE_SHIPPING'?0:1} max={type==='PERCENTAGE'?100:2147483647} required disabled={type==='FREE_SHIPPING'} defaultValue={type==='PERCENTAGE'?10:type==='FIXED_AMOUNT'?50000:0}/></label>
      <label>Đơn tối thiểu (VND)<input type="number" name="minOrder" min={0} max={2147483647} required defaultValue={0}/></label>
      {type==='PERCENTAGE'&&<label>Giảm tối đa (VND, bỏ trống nếu không giới hạn)<input type="number" name="maxDiscount" min={1} max={2147483647}/></label>}
      <label>Tổng lượt dùng (bỏ trống = không giới hạn)<input type="number" name="usageLimit" min={1} max={2147483647}/></label>
      <label>Lượt mỗi khách<input type="number" name="usagePerUser" min={1} max={10000} required defaultValue={1}/></label>
      <label>Bắt đầu (giờ máy của bạn)<input type="datetime-local" name="startsAt" required/></label>
      <label>Kết thúc (giờ máy của bạn)<input type="datetime-local" name="expiresAt" required/></label>
      <div><button className="button button-primary" type="submit">{busy?'Đang lưu…':'Tạo coupon'}</button></div>
    </fieldset></form></details>}
    <ResourceStatus error={resource.error} loading={resource.loading} retry={resource.reload}/>
    {resource.data&&<section className="admin-card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Mã</th><th>Ưu đãi</th><th>Thời gian</th><th>Lượt dùng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {resource.data.items.map((c)=><tr key={c.id}><td><strong>{c.code}</strong><br/>{c.name}</td><td>{c.type==='PERCENTAGE'?`${c.value}%`:c.type==='FREE_SHIPPING'?'Freeship':formatMoney(c.value)}<br/><small>Đơn từ {formatMoney(c.minOrder)}{c.maxDiscount?` / Trần ${formatMoney(c.maxDiscount)}`:''}</small></td><td>{formatDateTime(c.startsAt)}<br/>{formatDateTime(c.expiresAt)}</td><td>{c.usedCount}/{c.usageLimit??'∞'}<br/><small>{c.usagePerUser}/khách</small></td><td>{!c.active?'Tạm dừng':Date.parse(c.expiresAt)<=Date.now()?'Hết hạn':Date.parse(c.startsAt)>Date.now()?'Đã lên lịch':c.usageLimit!==null&&c.usedCount>=c.usageLimit?'Hết lượt':'Đang bật'}</td><td>{canEdit&&<button disabled={busy} type="button" className="button button-outline button-sm" onClick={()=>void toggle(c)}>{c.active?'Tạm dừng':'Bật'}</button>}</td></tr>)}
      {!resource.data.items.length&&<tr><td colSpan={6}>Không có coupon phù hợp.</td></tr>}
    </tbody></table></div><Pagination page={page} pageSize={20} total={resource.data.total} onChange={setPage}/></section>}
  </>;
}
