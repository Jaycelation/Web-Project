import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots { const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'; return { rules: [{ userAgent: '*', allow: '/', disallow: ['/tai-khoan/', '/quan-tri/', '/thanh-toan'] }], sitemap: `${base}/sitemap.xml` }; }
