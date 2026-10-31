/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 31-10-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : home-catalogue
 * Scope        : Customer Pages — Homepage
 *
 * Description  : Turns the active service catalogue into what the homepage
 *                shows: one tile per salon category plus a single Spa tile
 *                ("What would you like today?"), and a short list of popular
 *                everyday services, each with its own Book link.
 *
 * Responsibilities :
 * - Build category tiles with a service count and "from" price
 * - Pick the popular services in a fixed, owner-editable order
 * - Format paise as whole rupees for display
 *
 * Tech Stack   : TypeScript
 * Layer        : Presentation helpers (pure)
 *
 * Notes        :
 * - Pure functions: the page fetches the catalogue and passes it in.
 * - All SPA categories collapse into one tile linking to /services#spa, so the
 *   grid stays at two even rows.
 ************************************************************/

export type HomeService = {
  id: string
  categoryId: string
  name: string
  slug: string
  durationMinutes: number
  pricePaise: number
}

export type HomeCategory = {
  id: string
  name: string
  serviceType: 'salon' | 'spa'
  services: HomeService[]
}

export type CategoryTile = {
  /** Category id, or 'spa' for the combined spa tile. Drives the icon. */
  key: string
  name: string
  href: string
  serviceCount: number
  fromPaise: number | null
}

export type PopularService = HomeService & { href: string }

// Everyday services shown under "Popular services", in this order. Any slug
// missing from the live catalogue is skipped.
export const POPULAR_SERVICE_SLUGS = [
  'haircut-basic',
  'wash-blowdry',
  'facial-classic',
  'cleanup-basic',
  'manicure-classic',
  'pedicure-spa',
  'hair-spa-basic',
  'swedish-60',
] as const

const SPA_TILE_NAME = 'Spa & massage'

function minPrice(services: HomeService[]): number | null {
  if (services.length === 0) return null
  return Math.min(...services.map((s) => s.pricePaise))
}

export function bookServiceHref(slug: string): string {
  return `/?book=1&service=${encodeURIComponent(slug)}`
}

export function buildCategoryTiles(categories: HomeCategory[]): CategoryTile[] {
  const tiles: CategoryTile[] = categories
    .filter((c) => c.serviceType === 'salon' && c.services.length > 0)
    .map((c) => ({
      key: c.id,
      name: c.name,
      href: `/services#${c.id}`,
      serviceCount: c.services.length,
      fromPaise: minPrice(c.services),
    }))

  const spaServices = categories.filter((c) => c.serviceType === 'spa').flatMap((c) => c.services)
  if (spaServices.length > 0) {
    tiles.push({
      key: 'spa',
      name: SPA_TILE_NAME,
      href: '/services#spa',
      serviceCount: spaServices.length,
      fromPaise: minPrice(spaServices),
    })
  }

  return tiles
}

export function pickPopularServices(categories: HomeCategory[]): PopularService[] {
  const bySlug = new Map(categories.flatMap((c) => c.services).map((s) => [s.slug, s]))
  return POPULAR_SERVICE_SLUGS.flatMap((slug) => {
    const service = bySlug.get(slug)
    return service ? [{ ...service, href: bookServiceHref(service.slug) }] : []
  })
}

export function formatRupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100)
}
