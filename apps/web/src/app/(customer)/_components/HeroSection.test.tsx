/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 12-06-2026 & Updated - 28-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : HeroSection (component test)
 * Scope        : Customer Pages — Homepage Hero
 *
 * Description  : Component tests for the homepage hero. Verifies the headline
 *                and CTAs render, and that the hero is text-only: no image and
 *                no location/hours card.
 *
 * Tech Stack   : Vitest, @testing-library/react, jsdom
 * Layer        : Testing (Presentation / Component)
 ************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HeroSection } from './HeroSection'

afterEach(() => {
  cleanup()
})

describe('HeroSection', () => {
  it('renders the headline and both CTAs', () => {
    render(<HeroSection />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Where beautymeets Royalty.',
    )
    expect(screen.getByRole('link', { name: 'Book an appointment at WeCut' })).toHaveAttribute(
      'href',
      '/?book=1',
    )
    expect(screen.getByRole('link', { name: 'Explore Services' })).toHaveAttribute(
      'href',
      '/services',
    )
  })

  it('is text-only: no image and no location/hours card', () => {
    const { container } = render(<HeroSection />)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText(/RAYASANDRA/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Visit' })).toBeNull()
  })
})
