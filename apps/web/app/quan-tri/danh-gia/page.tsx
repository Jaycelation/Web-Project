import type {Metadata} from 'next';
import {AdminReviews} from '@/components/admin-reviews';
import {AdminShell} from '@/components/admin-shell';
export const metadata:Metadata={title:'Duyệt đánh giá',robots:{index:false,follow:false}};
export default function Page(){return <AdminShell><AdminReviews/></AdminShell>;}
