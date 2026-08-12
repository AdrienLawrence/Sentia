import type { MetadataRoute } from 'next'

const SITE_URL = 'https://sentia-nu.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/accessibility', '/privacy', '/terms'],
      disallow: [
        '/api/',
        '/auth/',
        '/dashboard',
        '/editor/',
        '/forgot-password',
        '/login',
        '/quiz',
        '/reset-password'
      ]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  }
}
