import type {Metadata} from 'next';
import {AdminAudit} from '@/components/admin-audit';
import {AdminShell} from '@/components/admin-shell';
export const metadata:Metadata={title:'Nhật ký',robots:{index:false,follow:false}};
export default function Page(){return <AdminShell><AdminAudit/></AdminShell>;}
