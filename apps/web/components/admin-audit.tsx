'use client';
import { useState } from 'react';
import type { AuditEntryDto,PageResult } from '@secure-commerce/contracts';
import { useAuth } from './auth-provider';
import { usePagedResource } from '@/lib/use-paged-resource';
import { formatDateTime } from '@/lib/format';
import { Pagination } from './pagination';
import { AdminSearch,ResourceStatus } from './admin-list-tools';
export function AdminAudit(){
  const {user}=useAuth();const[page,setPage]=useState(1),[query,setQuery]=useState('');
  const resource=usePagedResource<PageResult<AuditEntryDto>>('/admin/audit',{page,pageSize:20,...(query?{query}:{})},user?.role==='ADMIN');
  if(user?.role!=='ADMIN')return <div className="alert alert-error">Chỉ ADMIN được xem nhật ký.</div>;
  return <><div className="admin-heading"><div><h1>Nhật ký quản trị</h1><p>Chỉ đọc; không xuất payload nhạy cảm lên giao diện.</p></div></div><AdminSearch onSearch={(q)=>{setQuery(q);setPage(1);}} placeholder="Hành động, loại hoặc ID đối tượng"/>
    <ResourceStatus error={resource.error} loading={resource.loading} retry={resource.reload}/>
    {resource.data&&<section className="admin-card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>
      {resource.data.items.map((e)=><tr key={e.id}><td>{formatDateTime(e.createdAt)}</td><td>{e.actor?.name??'Hệ thống'}</td><td><code>{e.action}</code></td><td>{e.entityType}<br/><small>{e.entityId??'—'}</small></td></tr>)}
      {!resource.data.items.length&&<tr><td colSpan={4}>Chưa có bản ghi.</td></tr>}
    </tbody></table></div><Pagination page={page} pageSize={20} total={resource.data.total} onChange={setPage}/></section>}
  </>;
}
