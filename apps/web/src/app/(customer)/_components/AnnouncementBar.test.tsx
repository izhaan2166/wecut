/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 01-08-2026 & Updated - 01-08-2026
 *
 * Project      : wecut-webapp
 * Module Name  : AnnouncementBar (component test)
 * Scope        : Customer Pages — Announcement Strip
 *
 * Description  : Component tests for the site-wide announcement strip, which
 *                reads the Payload `banner` record.
 *
 * Responsibilities :
 * - Test a CTA-bearing banner drives the strip copy/link
 * - Test a CTA-less banner leaves the strip on its fallback copy
 * - Test a whitespace-only ctaHref counts as absent
 * - Test `order` decides, and the strip picks the first CTA-bearing banner
 *
 * Tech Stack   : Vitest, @testing-library/react, jsdom, MSW
 * Layer        : Testing (Presentation / Component)
 *
 * Notes        :
 * - AnnouncementBar is an async server component: it is awaited to get its
 *   element, then rendered. No client-side data fetching is involved.
 * - MSW backs the Payload REST read; `NEXT_PUBLIC_CMS_URL` is stubbed per case.
 ************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw/http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw-server'
import { AnnouncementBar } from './AnnouncementBar'

const CMS_URL = 'https://cms.test'
const FALLBACK_HEADLINE = /Monsoon Glow offers/
const FALLBACK_HREF = '/offers'
const BANNER_IMAGE_URL = 'https://cdn.test/banner.jpg'

/** A raw Payload banner doc (headline + resolvable image required by the mapper). */
function bannerDoc(overrides?: Record<string, unknown>) {
  return {
    headline: 'Monsoon Glow Offer',
    image: { url: BANNER_IMAGE_URL, alt: 'Monsoon offer' },
    ctaLabel: 'Book now',
    ctaHref: '/?book=1',
    order: 0,
    ...overrides,
  }
}

/** Serve the given banner docs from the mocked Payload REST API. */
function serveBanners(docs: Record<string, unknown>[]) {
  server.use(http.get(`${CMS_URL}/api/banner`, () => HttpResponse.json({ docs })))
}

/** The strip's single link — the whole bar is one anchor. */
function stripLink() {
  return screen.getByRole('link', { name: /./ })
}

afterEach(() => {
  cleanup()
})

describe('AnnouncementBar', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CMS_URL', CMS_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders the CMS headline and CTA link when the banner has a ctaHref', async () => {
    serveBanners([
      bannerDoc({ headline: 'Diwali Glow — 25% off rituals', ctaHref: '/offers/diwali' }),
    ])

    render(await AnnouncementBar())

    const link = screen.getByRole('link', { name: 'Diwali Glow — 25% off rituals' })
    expect(link).toHaveAttribute('href', '/offers/diwali')
  })

  it('falls back to the hardcoded copy when the banner has NO ctaHref', async () => {
    serveBanners([bannerDoc({ headline: 'Hero refresh only', ctaHref: null, ctaLabel: null })])

    render(await AnnouncementBar())

    // The banner exists and is active, but with nowhere to click it is hero
    // artwork only — the strip must NOT adopt its headline.
    expect(screen.queryByText('Hero refresh only')).toBeNull()
    expect(stripLink()).toHaveTextContent(FALLBACK_HEADLINE)
    expect(stripLink()).toHaveAttribute('href', FALLBACK_HREF)
  })

  it('treats a whitespace-only ctaHref as absent', async () => {
    serveBanners([bannerDoc({ headline: 'Blank link', ctaHref: '   ' })])

    render(await AnnouncementBar())

    expect(screen.queryByText('Blank link')).toBeNull()
    expect(stripLink()).toHaveTextContent(FALLBACK_HEADLINE)
    expect(stripLink()).toHaveAttribute('href', FALLBACK_HREF)
  })

  it('picks the first CTA-bearing banner in `order`, skipping a CTA-less earlier one', async () => {
    serveBanners([
      bannerDoc({ headline: 'Third in order', ctaHref: '/offers/third', order: 3 }),
      bannerDoc({ headline: 'First in order, no link', ctaHref: null, order: 1 }),
      bannerDoc({ headline: 'Second in order', ctaHref: '/offers/second', order: 2 }),
    ])

    render(await AnnouncementBar())

    const link = screen.getByRole('link', { name: 'Second in order' })
    expect(link).toHaveAttribute('href', '/offers/second')
  })

  it('falls back to the hardcoded copy when no banner is active', async () => {
    serveBanners([])

    render(await AnnouncementBar())

    expect(stripLink()).toHaveTextContent(FALLBACK_HEADLINE)
    expect(stripLink()).toHaveAttribute('href', FALLBACK_HREF)
  })
})
