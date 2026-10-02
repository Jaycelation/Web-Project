import type {Metadata} from 'next';
import {AdminCoupons} from '@/components/admin-coupons';
import {AdminShell} from '@/components/admin-shell';
export const metadata:Metadata={title:'Khuyến mãi',robots:{index:false,follow:false}};
export default function Page(){return <AdminShell><AdminCoupons/></AdminShell>;}
