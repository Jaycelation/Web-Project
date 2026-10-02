import type { Metadata } from 'next';
import { CollectionView } from '@/components/collection-view';
export const metadata: Metadata = { title: 'Đã xem', robots: { index: false, follow: false } };
export default function Page() { return <CollectionView kind="recent" />; }
