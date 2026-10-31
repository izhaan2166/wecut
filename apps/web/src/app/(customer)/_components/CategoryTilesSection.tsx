/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 31-10-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : CategoryTilesSection
 * Scope        : Customer Pages — Homepage
 *
 * Description  : "What would you like today?" — one large, tappable tile per
 *                service category, each showing how many services it holds and
 *                its starting price. A tile opens that category on /services.
 *
 * Responsibilities :
 * - Render the category tiles built by buildCategoryTiles
 * - Pick a line icon per category
 *
 * Tech Stack   : React (server), Next.js 16 (App Router), Tailwind CSS v4,
 *                lucide-react
 * Layer        : Presentation (Component)
 *
 * Dependencies : ./home-catalogue, lucide-react, next/link
 ************************************************************/

import {
  ArrowRight,
  Brush,
  Droplets,
  Feather,
  Flower2,
  Hand,
  type LucideIcon,
  Palette,
  Scissors,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { type CategoryTile, formatRupees } from './home-catalogue'

const TILE_ICONS: Record<string, LucideIcon> = {
  cat_haircut: Scissors,
  cat_colour: Palette,
  cat_facial: Sparkles,
  cat_waxing: Feather,
  cat_mani_pedi: Hand,
  cat_makeup: Brush,
  cat_hair_spa: Droplets,
  spa: Flower2,
}

function tileSubtitle(tile: CategoryTile): string {
  const count = `${tile.serviceCount} ${tile.serviceCount === 1 ? 'service' : 'services'}`
  return tile.fromPaise === null ? count : `${count} · from ${formatRupees(tile.fromPaise)}`
}

export function CategoryTilesSection({ tiles }: { tiles: CategoryTile[] }) {
  return (
    <section aria-labelledby="categories-heading" className="bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-10 lg:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="categories-heading"
              className="font-display text-[clamp(34px,5vw,52px)] leading-[1.05] text-ink"
            >
              What would you like today?
            </h2>
            <p className="mt-3 font-sans text-[17px] text-ink-soft">
              Pick a category. Every service shows its price before you book.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex min-h-[44px] items-center gap-2 font-ui font-semibold text-ink underline-offset-4 hover:underline"
          >
            All services &amp; prices
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {tiles.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => {
              const Icon = TILE_ICONS[tile.key] ?? Sparkles
              return (
                <li key={tile.key}>
                  <Link
                    href={tile.href}
                    className="flex h-full items-center gap-4 rounded-[14px] border border-hairline bg-paper p-5 transition-colors duration-200 hover:border-ink"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-white text-ink">
                      <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-ui text-[17px] font-semibold text-ink">
                        {tile.name}
                      </span>
                      <span className="font-sans text-sm text-ink-soft">{tileSubtitle(tile)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="font-sans text-ink-soft">
            Our menu is loading slowly right now.{' '}
            <Link href="/services" className="font-semibold text-ink underline">
              See all services
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  )
}
