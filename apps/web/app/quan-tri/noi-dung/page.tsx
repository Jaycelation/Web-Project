import type {Metadata} from 'next';
import {AdminContent} from '@/components/admin-content';
import {AdminShell} from '@/components/admin-shell';
export const metadata:Metadata={title:'Nội dung',robots:{index:false,follow:false}};
export default function Page(){return <AdminShell><AdminContent/></AdminShell>;}
