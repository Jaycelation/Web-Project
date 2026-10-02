'use client';
import { useState } from 'react';
import { useAuth } from './auth-provider';
import { usePagedResource } from '@/lib/use-paged-resource';
import { apiErrorMessage,browserRequest } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Pagination } from './pagination';
import { AdminSearch,ResourceStatus } from './admin-list-tools';
interface Customer { id:string;name:string;email:string;phone:string|null;status:'ACTIVE'|'LOCKED';orderCount:number;lifetimeValue:number }
export function AdminCustomers(){
  const {user}=useAuth();const[page,setPage]=useState(1),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const resource=usePagedResource<{items:Customer[];total:number}>('/admin/customers',{page,pageSize:20,...(query?{query}:{})});
  const change=async(c:Customer)=>{
    if(!confirm(`${c.status==='ACTIVE'?'Khóa và thu hồi phiên đăng nhập của':'Mở khóa'} ${c.email}?`))return;
    setBusy(true);setError('');try{await browserRequest('/admin/customers/status',{userId:c.id,status:c.status==='ACTIVE'?'LOCKED':'ACTIVE'});resource.reload();}
    catch(cause){setError(apiErrorMessage(cause));}finally{setBusy(false);}
  };
  return <><div className="admin-heading"><div><h1>Khách hàng</h1><p>Tra cứu, xem giá trị mua hàng và quản lý trạng thái tài khoản.</p></div></div>
    <AdminSearch onSearch={(q)=>{setQuery(q);setPage(1);}} placeholder="Tên, email hoặc số điện thoại"/>
    {error&&<div className="alert alert-error" role="alert">{error}</div>}<ResourceStatus error={resource.error} loading={resource.loading} retry={resource.reload}/>
    {resource.data&&<section className="admin-card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Số đơn</th><th>Giá trị đã giao</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {resource.data.items.map((c)=><tr key={c.id}><td>{c.name}</td><td>{c.email}<br/>{c.phone??'—'}</td><td>{c.orderCount}</td><td>{formatMoney(c.lifetimeValue)}</td><td>{c.status==='ACTIVE'?'Hoạt động':'Đã khóa'}</td><td>{user?.role==='ADMIN'&&<button className="button button-outline button-sm" disabled={busy} onClick={()=>void change(c)} type="button">{c.status==='ACTIVE'?'Khóa':'Mở khóa'}</button>}</td></tr>)}
      {!resource.data.items.length&&<tr><td colSpan={6}>Không tìm thấy khách hàng.</td></tr>}
    </tbody></table></div><Pagination page={page} pageSize={20} total={resource.data.total} onChange={setPage}/></section>}
  </>;
}
