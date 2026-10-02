import type {Metadata} from 'next';
import {AdminCustomers} from '@/components/admin-customers';
import {AdminShell} from '@/components/admin-shell';
export const metadata:Metadata={title:'Khách hàng',robots:{index:false,follow:false}};
export default function Page(){return <AdminShell><AdminCustomers/></AdminShell>;}
