/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 31-10-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : home-catalogue (unit test)
 * Scope        : Customer Pages — Homepage
 *
 * Description  : Unit tests for the homepage catalogue helpers: category
 *                tiles (salon tiles plus one combined spa tile) and the
 *                popular-services pick.
 *
 * Tech Stack   : Vitest
 * Layer        : Testing (Presentation helpers)
 ************************************************************/

import { describe, expect, it } from 'vitest'
import {
  buildCategoryTiles,
  formatRupees,
  type HomeCategory,
  type HomeService,
  pickPopularServices,
} from './home-catalogue'

function svc(categoryId: string, slug: string, pricePaise: number): HomeService {
  return { id: `svc_${slug}`, categoryId, name: slug, slug, durationMinutes: 30, pricePaise }
}

const catalogue: HomeCategory[] = [
  {
    id: 'cat_haircut',
    name: 'Haircut & Styling',
    serviceType: 'salon',
    services: [
      svc('cat_haircut', 'haircut-basic', 50000),
      svc('cat_haircut', 'wash-blowdry', 40000),
    ],
  },
  { id: 'cat_empty', name: 'Empty', serviceType: 'salon', services: [] },
  {
    id: 'cat_standard_spa',
    name: 'Standard SPA Service',
    serviceType: 'spa',
    services: [svc('cat_standard_spa', 'swedish-60', 200000)],
  },
  {
    id: 'cat_premium_spa',
    name: 'Premium SPA Service',
    serviceType: 'spa',
    services: [svc('cat_premium_spa', 'balinese-60', 300000)],
  },
]

describe('buildCategoryTiles', () => {
  it('makes one tile per non-empty salon category and one combined spa tile', () => {
    expect(buildCategoryTiles(catalogue)).toEqual([
      {
        key: 'cat_haircut',
        name: 'Haircut & Styling',
        href: '/services#cat_haircut',
        serviceCount: 2,
        fromPaise: 40000,
      },
      {
        key: 'spa',
        name: 'Spa & massage',
        href: '/services#spa',
        serviceCount: 2,
        fromPaise: 200000,
      },
    ])
  })

  it('returns no tiles for an empty catalogue', () => {
    expect(buildCategoryTiles([])).toEqual([])
  })
})

describe('pickPopularServices', () => {
  it('keeps the curated order, skips missing slugs and links each to booking', () => {
    const picked = pickPopularServices(catalogue)
    expect(picked.map((s) => s.slug)).toEqual(['haircut-basic', 'wash-blowdry', 'swedish-60'])
    expect(picked[0]?.href).toBe('/?book=1&service=haircut-basic')
  })
})

describe('formatRupees', () => {
  it('formats paise as whole rupees', () => {
    expect(formatRupees(150000)).toBe('₹1,500')
  })
})
