import type { MetadataRoute } from 'next'

const SITE_URL = 'https://sentia-nu.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-08-12')

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: `${SITE_URL}/accessibility`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3
    }
  ]
}
