/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : HomePage
 * Scope        : Customer Pages
 *
 * Description  : Main homepage. Editorial split hero, then the quick paths a
 *                customer needs: category tiles ("What would you like
 *                today?"), popular services with a Book button on each row,
 *                visit cards (directions, call, WhatsApp, hours) and the FAQ.
 *
 * Responsibilities :
 * - Load the active service catalogue once and hand it to the tiles and the
 *   popular list
 * - Render the hero, category tiles, popular services, visit cards and FAQ
 * - Emit JSON-LD structured data
 *
 * Tech Stack   : React, Next.js 16 App Router, Tailwind CSS v4
 * Layer        : Presentation
 *
 * Dependencies : JsonLd, resolveFaqs, getActiveCatalogue, SEO helpers
 *
 * Notes        :
 * - ISR with 1-hour revalidation for the catalogue and FAQ content
 * - If the catalogue cannot be read, the tiles fall back to a link to
 *   /services and the popular list is hidden; the page still renders.
 * - Every Book Now link lands here as `/?book=1`. A signed-in account without
 *   a completed profile is sent to /onboarding first, before the booking
 *   dialog opens (requireProfileBeforeBooking).
 * - Without booking intent, a signed-in customer without a completed profile is
 *   re-prompted to /onboarding at most once per 24h (repromptPendingOnboarding).
 ************************************************************/

import { getActiveCatalogue } from '@rgss/db/queries'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { FALLBACK_SERVICE_CARDS } from '@/lib/cms/client'
import { resolveFaqs } from '@/lib/cms/faqs'
import { repromptPendingOnboarding, requireProfileBeforeBooking } from '@/lib/onboarding-guard'
import {
  faqPageJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import { CategoryTilesSection } from './_components/CategoryTilesSection'
import { FaqSection } from './_components/FaqSection'
import { HeroSection } from './_components/HeroSection'
import {
  buildCategoryTiles,
  type HomeCategory,
  pickPopularServices,
} from './_components/home-catalogue'
import { PopularServicesSection } from './_components/PopularServicesSection'
import { VisitSection } from './_components/VisitSection'

export const metadata: Metadata = buildMetadata({
  title: 'Premium Salon & Spa in Bengaluru',
  description:
    'Experience premium salon and spa services in Bengaluru. Expert haircuts, facials, body therapies, and luxury SPA treatments. Book your appointment today.',
  path: '/',
})

export const revalidate = 3600

// The hero photo: the salon's hair-styling shot from the service-card set.
const HERO_IMAGE = FALLBACK_SERVICE_CARDS[0]?.image

async function loadCatalogue(): Promise<HomeCategory[]> {
  try {
    return await getActiveCatalogue()
  } catch {
    return []
  }
}

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams

  // Both onboarding redirects run before the CMS reads, so a redirect does not
  // pay for them. See lib/onboarding-guard.ts.
  // Book Now (`?book=1`) by a signed-in account with no profile: onboarding
  // comes first, so nobody fills in a booking the API would then refuse.
  await requireProfileBeforeBooking(params)
  // Otherwise a gentle re-prompt: at most once per 24h, and only for signed-in
  // customers without a profile.
  await repromptPendingOnboarding(params)

  const [faqList, catalogue] = await Promise.all([resolveFaqs(), loadCatalogue()])

  return (
    <>
      {/* JSON-LD Structured Data */}
      <JsonLd
        data={[
          localBusinessJsonLd(),
          organizationJsonLd(),
          websiteJsonLd(),
          faqPageJsonLd(faqList),
        ]}
      />

      <div className="flex flex-col">
        <HeroSection image={HERO_IMAGE} />
        <CategoryTilesSection tiles={buildCategoryTiles(catalogue)} />
        <PopularServicesSection services={pickPopularServices(catalogue)} />
        <VisitSection />
        <FaqSection faqs={faqList} />
      </div>
    </>
  )
}
