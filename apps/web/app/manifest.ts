import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return { name: 'MIRA', short_name: 'MIRA', description: 'Thiết bị công nghệ cho cuộc sống hiện đại', start_url: '/', display: 'standalone', background_color: '#f7f7f5', theme_color: '#f7f7f5', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] }; }
