'use client';
import Link from 'next/link';
import { usePathname,useRouter } from 'next/navigation';
import { useEffect,type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { LoadingState } from './loading-state';
const links = [
  ['/quan-tri','Tổng quan'],['/quan-tri/san-pham','Sản phẩm & tồn kho'],['/quan-tri/don-hang','Đơn hàng'],
  ['/quan-tri/khach-hang','Khách hàng'],['/quan-tri/khuyen-mai','Khuyến mãi'],['/quan-tri/danh-gia','Duyệt đánh giá'],
  ['/quan-tri/noi-dung','Nội dung'],['/quan-tri/nhat-ky','Nhật ký'],
] as const;
export function AdminShell({children}:{children:ReactNode}){
  const pathname=usePathname(),router=useRouter();const{user,loading}=useAuth();
  useEffect(()=>{if(!loading&&(!user||!['ADMIN','STAFF'].includes(user.role)))router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);},[loading,router,user,pathname]);
  if(loading||!user||!['ADMIN','STAFF'].includes(user.role))return <LoadingState label="Đang kiểm tra quyền quản trị…"/>;
  return <div className="admin-shell"><aside className="admin-sidebar"><h2>MIRA OPERATIONS</h2><p>{user.name} · {user.role}</p><nav aria-label="Quản trị">
    {links.filter(([href])=>href!=='/quan-tri/nhat-ky'||user.role==='ADMIN').map(([href,label])=><Link key={href} className={pathname===href?'active':''} aria-current={pathname===href?'page':undefined} href={href}>{label}</Link>)}
    <Link href="/tai-khoan">Tài khoản của tôi</Link><Link href="/">Về cửa hàng</Link>
  </nav></aside><div className="admin-main">{children}</div></div>;
}
