/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 08-06-2026
 *
 * Project      : wecut-webapp
 * Module Name  : Header
 * Scope        : Layout
 *
 * Description  : Site-wide header. White/90 glass background, logo (image +
 *                wordmark), desktop nav links, and the account menu when
 *                logged in. There is no sign-in button or One Tap prompt.
 *                Rebuilt on the shadcn/ui Button primitive with lucide icons.
 *
 * Responsibilities :
 * - Render logo (40×40 image + Cabinet Grotesk wordmark)
 * - Render desktop nav: Services, Offers, About, Contact, Blog
 * - Logged in: UserMenu dropdown (notifications, bookings, etc. live inside it)
 * - Add scroll-triggered border shadow
 * - Toggle mobile nav panel
 *
 * Tech Stack   : React, TypeScript, Next.js, Tailwind CSS v4, shadcn/ui,
 *                lucide-react
 * Layer        : Presentation (Layout)
 *
 * Dependencies : @/components/ui/button, UserMenu, useSession, MobileNav,
 *                lucide-react
 ************************************************************/

'use client'

import { ChevronDown, Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { MobileNav } from './MobileNav'
import { UserMenu } from './UserMenu'

const navLinks = [
  { href: '/services', label: 'Services' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/blog', label: 'Blog' },
]

type HeaderUser = {
  name: string | null
  email: string | null
  image: string | null
  role: string | null
}

export function Header({ initialUser = null }: { initialUser?: HeaderUser | null }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const { data: session, isPending } = useSession()
  // First paint uses the server-resolved user (no signed-out → avatar flash on
  // refresh); once the client session resolves we trust it so live sign-in /
  // sign-out still update the header without a reload.
  const user: HeaderUser | null = isPending
    ? initialUser
    : session?.user
      ? {
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
          // Preserve the server-resolved role across hydration in case the
          // client session payload omits the custom role field.
          role: (session.user as { role?: string | null }).role ?? initialUser?.role ?? null,
        }
      : null

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md transition-all duration-200',
        isScrolled ? 'top-0 shadow-md' : 'top-9',
      )}
    >
      <div className="container mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 md:px-8">
        {/* ── Logo ── */}
        <Link href="/" className="flex items-center" aria-label="WeCut — Go to homepage">
          {/* Text-only brand lockup: wordmark + Salon & Spa descriptor */}
          <span className="flex flex-col leading-none">
            <span className="font-display text-[19px] font-black tracking-tight text-cocoa-dark">
              WeCut
            </span>
            <span className="mt-1 font-ui text-[10px] font-semibold uppercase tracking-[0.22em] text-warm-gray">
              Salon &amp; Spa
            </span>
          </span>
        </Link>

        {/* ── Desktop Nav ── */}
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative py-1 font-ui text-sm font-bold text-cocoa-dark transition-colors duration-200 hover:text-gold-ink',
                pathname === link.href &&
                  'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-deep-gold',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ── Auth CTA ── */}
        {user ? (
          <div className="hidden items-center md:flex">
            <UserMenu user={user} />
          </div>
        ) : null}

        {/* ── Mobile right side ── */}
        <div className="flex items-center gap-2 md:hidden">
          {user ? (
            // Logged in: avatar button opens the drawer (account + nav inside).
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open account menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav"
              className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 transition-colors hover:bg-cloud-gray active:scale-95"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="size-9 rounded-full border border-outline-gray object-cover"
                />
              ) : (
                <span
                  className="flex size-9 items-center justify-center rounded-full bg-warm-gold font-ui text-sm font-bold text-cocoa-dark"
                  aria-hidden="true"
                >
                  {user.name?.trim().charAt(0).toUpperCase() ?? 'G'}
                </span>
              )}
              <ChevronDown className="size-4 text-warm-gray" aria-hidden="true" />
            </button>
          ) : null}

          {/* Hamburger — shown while signed out / loading; hidden once signed in
              (the avatar opens the same drawer). */}
          {!user && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-cocoa-dark"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav"
            >
              <Menu aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        user={user}
      />
    </header>
  )
}
