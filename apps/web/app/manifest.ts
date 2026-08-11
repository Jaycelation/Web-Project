import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return { name: 'Secure Commerce', short_name: 'SecureCommerce', description: 'MVP thương mại điện tử bảo mật', start_url: '/', display: 'standalone', background_color: '#f4f7f8', theme_color: '#0c1b2a', icons: [] }; }
