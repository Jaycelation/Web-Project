'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {usePagedResource} from '@/lib/use-paged-resource';
import {apiErrorMessage,browserRequest} from '@/lib/api';
import {ResourceStatus} from './admin-list-tools';
interface Content {slug:string;title:string;content:string;published:boolean;seoTitle:string|null;seoDescription:string|null}
export function AdminContent(){
  const resource=usePagedResource<Content[]>('/admin/content',{});const[slug,setSlug]=useState(''),[draft,setDraft]=useState<Content|null>(null);
  const[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{const selected=resource.data?.find((p)=>p.slug===slug)??resource.data?.[0];if(selected)setDraft(selected);},[resource.data,slug]);
  const save=async(event:FormEvent)=>{event.preventDefault();if(!draft)return;setBusy(true);setError('');setMessage('');
    try{await browserRequest('/admin/content/update',{slug:draft.slug,title:draft.title,content:draft.content,published:draft.published,seoTitle:draft.seoTitle??'',seoDescription:draft.seoDescription??''});setMessage('Đã lưu nội dung.');resource.reload();}
    catch(cause){setError(apiErrorMessage(cause));}finally{setBusy(false);}};
  return <><div className="admin-heading"><div><h1>Nội dung & chính sách</h1><p>Văn bản thuần, không thực thi HTML. Cần rà soát nội dung trước khi công bố.</p></div></div>
    <ResourceStatus error={resource.error} loading={resource.loading} retry={resource.reload}/>{error&&<div className="alert alert-error" role="alert">{error}</div>}{message&&<div className="alert alert-success" role="status">{message}</div>}
    {draft&&<section className="admin-card"><label>Chọn trang<select value={draft.slug} disabled={busy} onChange={(e)=>setSlug(e.target.value)}>{resource.data?.map((p)=><option value={p.slug} key={p.slug}>{p.title}</option>)}</select></label>
      <form className="upgrade-form" onSubmit={save}><fieldset disabled={busy}>
        <label>Tiêu đề<input required minLength={2} maxLength={180} value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></label>
        <label>Nội dung<textarea required minLength={2} maxLength={50000} rows={14} value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})}/></label>
        <label>Tiêu đề SEO<input maxLength={180} value={draft.seoTitle??''} onChange={(e)=>setDraft({...draft,seoTitle:e.target.value})}/></label>
        <label>Mô tả SEO<input maxLength={320} value={draft.seoDescription??''} onChange={(e)=>setDraft({...draft,seoDescription:e.target.value})}/></label>
        <label className="filter-option"><input type="checkbox" checked={draft.published} onChange={(e)=>setDraft({...draft,published:e.target.checked})}/>Công khai</label>
        <button className="button button-primary" type="submit">{busy?'Đang lưu…':'Lưu thay đổi'}</button>
      </fieldset></form></section>}
  </>;
}
