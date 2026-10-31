/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : BookingDialog
 * Scope        : Booking UI
 *
 * Description  : 4-step booking dialog modal over the homepage. Handles service
 *                selection, date/slot picking, summary, and submission with
 *                session persistence across OAuth redirect.
 *
 * Responsibilities :
 * - Render 4-step booking flow (branch + date → categories → services → summary)
 * - Fetch branches, services and availability from API
 * - Persist booking intent to sessionStorage for OAuth redirect
 * - Submit booking with analytics tracking
 * - Provide accessible modal with focus trap, escape, and scroll lock
 *
 * Features / Functionality :
 * - 4-step wizard with back/next navigation
 * - Branch picker (GET /api/branches); times and the booking are for the
 *   chosen branch, and availability is never requested without one
 * - Salon/SPA toggle with category and service multi-select
 * - Running total with INR formatting
 * - Session intent restoration after sign-in redirect
 * - Full accessibility: focus trap, aria-modal, keyboard navigation
 *
 * Tech Stack   : React, TypeScript, Tailwind CSS
 * Layer        : Frontend
 *
 * Dependencies : @/lib/analytics/events, @/lib/auth-client
 *
 * Notes        : None
 ************************************************************/

'use client'

import type { BranchStatusValue, PublicBranch, PublicBranchList } from '@rgss/types'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics/events'
import { useSession } from '@/lib/auth-client'
import { markBookingIntentForOnboarding } from '@/lib/google-signin'
import { ONBOARDING_PATH } from '@/lib/onboarding-prompt'

// --- Types (mirror GET /api/services response) ---
type ServiceType = 'salon' | 'spa'

interface ApiService {
  id: string
  categoryId: string
  name: string
  slug: string
  durationMinutes: number
  pricePaise: number
  description?: string | null
}

interface ApiCategory {
  id: string
  name: string
  slug: string
  serviceType: ServiceType
  displayOrder: number
  services: ApiService[]
}

interface AvailabilitySlot {
  startTime: string
  endTime: string
  available: boolean
}

const BOOKING_INTENT_KEY = 'rgss_booking_intent'

// What the focus trap moves between.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Wording for a branch that is listed but not taking bookings.
const BRANCH_STATUS_LABEL: Record<BranchStatusValue, string> = {
  operational: 'Open',
  temporarily_closed: 'Temporarily closed',
  opens_soon: 'Opening soon',
  shutdown: 'Closed',
}

function branchLabel(branch: PublicBranch): string {
  return `${branch.name}, ${branch.city}`
}

interface BookingIntent {
  // Absent in intents saved before the branch picker existed.
  branchId?: string | null
  date: string | null
  time: string | null
  serviceType: ServiceType
  categoryIds: string[]
  serviceIds: string[]
  notes: string
}

// --- Formatting helpers ---
function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100)
}

// Local (IST for our users) calendar date → YYYY-MM-DD, no UTC drift.
function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getNext14Days(): Date[] {
  const days: Date[] = []
  const today = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-IN', { weekday: 'short' })
}

// "Saturday, 1 November", for screen readers on the day cards.
function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

// "Sat, 1 Nov", for the ticket.
function formatTicketDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// "15:30" or "15:30:00" → "03:30 PM"
function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = mStr ?? '00'
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${String(h12).padStart(2, '0')}:${m} ${period}`
}

// Loose client-side check for a 10-digit Indian mobile (the server validates).
function isLikelyPhone(value: string): boolean {
  return /^(?:\+?91|0)?[6-9]\d{9}$/.test(value.replace(/[\s-]/g, ''))
}

// --- Component ---
interface BookingDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function BookingDialog({ isOpen, onClose }: BookingDialogProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const [step, setStep] = useState(1)
  // True when the dialog was opened from a service's own Book link: the
  // service is already chosen, so the category and service steps are skipped.
  const [servicePicked, setServicePicked] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [serviceType, setServiceType] = useState<ServiceType>('salon')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  // Guest details: without sign-in the request is emailed to the salon.
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  // Branch picker. `selectedBranchId` is the customer's (or a restored) choice;
  // `activeBranchId` below is the branch actually used. The list is loading
  // while it is neither loaded nor failed; `branchesAttempt` re-runs the fetch.
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [branchList, setBranchList] = useState<PublicBranchList | null>(null)
  const [branchesError, setBranchesError] = useState<string | null>(null)
  const [branchesAttempt, setBranchesAttempt] = useState(0)

  // Data + async state
  const [categories, setCategories] = useState<ApiCategory[] | null>(null)
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesError, setServicesError] = useState<string | null>(null)

  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [bookingNumber, setBookingNumber] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)

  // The branch availability and the booking use: the customer's choice while
  // it is taking bookings, otherwise the default branch. Derived rather than
  // stored, so a restored or stale choice is never sent.
  const activeBranchId = useMemo(() => {
    if (!branchList) return null
    const chosen = branchList.branches.find((b) => b.id === selectedBranchId)
    return chosen?.acceptingBookings ? chosen.id : branchList.defaultBranchId
  }, [branchList, selectedBranchId])

  const activeBranch = useMemo(
    () => branchList?.branches.find((b) => b.id === activeBranchId) ?? null,
    [branchList, activeBranchId],
  )

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Funnel: dialog opened. Fire once per open transition (not on every render).
  useEffect(() => {
    if (isOpen) {
      track('booking_started')
    }
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Move focus into the dialog when it opens, and back to its top when the
  // content holding the focus is replaced (a step change, the success view).
  // Not when data loads: that pulled focus off the control in use, so every
  // time the times reloaded the branch picker or date lost focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `step` and `isSubmitted` are deliberate triggers; see comment above.
  useEffect(() => {
    if (!isOpen) return
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
  }, [isOpen, step, isSubmitted])

  // Keep Tab inside the dialog. Focusable elements are read on each keypress,
  // so content that appears after opening (branches, times) is included.
  useEffect(() => {
    if (!isOpen) return
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (!dialogRef.current.contains(active)) {
        // The focused element was removed (e.g. "Try again"): bring focus back.
        e.preventDefault()
        if (e.shiftKey) last.focus()
        else first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [isOpen])

  // Load the branch list when the dialog first opens, and again on "Try again"
  // (`branchesAttempt`). Once loaded it is kept for the page's lifetime, like
  // the services catalogue. Closing mid-load drops the response; the next open
  // fetches again because the list is still missing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `branchList` is a load-once guard, not a trigger, and `branchesAttempt` is the retry trigger; see comment above.
  useEffect(() => {
    if (!isOpen || branchList) return
    let cancelled = false
    setBranchesError(null)
    fetch('/api/branches')
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) throw new Error('GET /api/branches failed')
        return json.data as PublicBranchList
      })
      .then((list) => {
        if (!cancelled) setBranchList(list)
      })
      .catch(() => {
        // Network, server and parse failures all read the same to a customer.
        if (!cancelled) setBranchesError('Could not load branches.')
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, branchesAttempt])

  // Fetch services when the dialog opens (once). Only re-run on open
  // transitions: the inner `categories`/`servicesLoading` guard and the
  // `cancelled` flag prevent duplicate fetches, and including `servicesLoading`
  // here would re-run the effect the moment it is set true, cancelling the
  // in-flight request before it can resolve.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional open-only trigger; see comment above.
  useEffect(() => {
    if (!isOpen || categories || servicesLoading) return
    let cancelled = false
    setServicesLoading(true)
    setServicesError(null)
    fetch('/api/services')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message ?? 'Could not load services.')
        }
        return json.data.categories as ApiCategory[]
      })
      .then((cats) => {
        if (!cancelled) setCategories(cats)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setServicesError(err instanceof Error ? err.message : 'Could not load services.')
        }
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  // Restore a saved booking intent (e.g. after returning from sign-in) once
  // services and branches are available, so the summary can name the services
  // and the branch. A saved branch that is no longer taking bookings falls
  // back to the default one through `activeBranchId`.
  useEffect(() => {
    if (!isOpen || !categories || !branchList || restoredRef.current) return
    restoredRef.current = true
    if (typeof window === 'undefined') return
    const raw = sessionStorage.getItem(BOOKING_INTENT_KEY)
    if (!raw) {
      // A service's own Book link (`/?book=1&service=<slug>`) opens the dialog
      // with that service already ticked.
      const slug = new URLSearchParams(window.location.search).get('service')
      const picked = slug
        ? categories.flatMap((c) => c.services).find((s) => s.slug === slug)
        : undefined
      const pickedCategory = picked && categories.find((c) => c.id === picked.categoryId)
      if (picked && pickedCategory) {
        setServiceType(pickedCategory.serviceType)
        setSelectedCategoryIds([pickedCategory.id])
        setSelectedServiceIds([picked.id])
        setServicePicked(true)
      }
      return
    }
    sessionStorage.removeItem(BOOKING_INTENT_KEY)
    try {
      const intent = JSON.parse(raw) as BookingIntent
      setSelectedBranchId(intent.branchId ?? null)
      if (intent.date) setSelectedDate(new Date(`${intent.date}T00:00:00`))
      setSelectedTime(intent.time)
      setServiceType(intent.serviceType)
      setSelectedCategoryIds(intent.categoryIds ?? [])
      setSelectedServiceIds(intent.serviceIds ?? [])
      setNotes(intent.notes ?? '')
      setStep(4)
    } catch {
      // Corrupt intent — ignore and start fresh.
    }
  }, [isOpen, categories, branchList])

  // Fetch availability for the chosen branch whenever the date or the branch
  // changes. Never requested without a branch: the API would then answer for
  // the default branch, which may not be the one on screen.
  useEffect(() => {
    if (!isOpen || !selectedDate || !activeBranchId) return
    let cancelled = false
    setSlotsLoading(true)
    setSlotsError(null)
    setSlots([])
    const query = new URLSearchParams({ date: toISODate(selectedDate), branchId: activeBranchId })
    fetch(`/api/availability?${query}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          throw new Error(json?.error?.message ?? 'Could not load slots.')
        }
        return json.data.slots as AvailabilitySlot[]
      })
      .then((s) => {
        if (!cancelled) setSlots(s)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSlotsError(err instanceof Error ? err.message : 'Could not load slots.')
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, selectedDate, activeBranchId])

  const reset = useCallback(() => {
    setStep(1)
    setServicePicked(false)
    setSelectedBranchId(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setServiceType('salon')
    setSelectedCategoryIds([])
    setSelectedServiceIds([])
    setNotes('')
    setGuestName('')
    setGuestPhone('')
    setGuestEmail('')
    setSlots([])
    setSlotsError(null)
    setSubmitError(null)
    setSubmitting(false)
    setIsSubmitted(false)
    setBookingNumber(null)
    restoredRef.current = false
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // Derived data
  const visibleCategories = useMemo(
    () => (categories ?? []).filter((c) => c.serviceType === serviceType),
    [categories, serviceType],
  )

  const allServices = useMemo(() => (categories ?? []).flatMap((c) => c.services), [categories])

  const servicesById = useMemo(() => {
    const map = new Map<string, ApiService>()
    for (const s of allServices) map.set(s.id, s)
    return map
  }, [allServices])

  // Services grouped under their (selected) category, for step 3.
  const groupedSelectedCategories = useMemo(
    () => visibleCategories.filter((c) => selectedCategoryIds.includes(c.id)),
    [visibleCategories, selectedCategoryIds],
  )

  const totalPaise = useMemo(
    () => selectedServiceIds.reduce((sum, id) => sum + (servicesById.get(id)?.pricePaise ?? 0), 0),
    [selectedServiceIds, servicesById],
  )

  const totalDuration = useMemo(
    () =>
      selectedServiceIds.reduce((sum, id) => sum + (servicesById.get(id)?.durationMinutes ?? 0), 0),
    [selectedServiceIds, servicesById],
  )

  const setServiceTypeAndReset = (t: ServiceType) => {
    setServiceType(t)
    setSelectedCategoryIds([])
    setSelectedServiceIds([])
  }

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
      // Drop any selected services whose category is no longer selected.
      if (!next.includes(id)) {
        const cat = visibleCategories.find((c) => c.id === id)
        if (cat) {
          const removed = new Set(cat.services.map((s) => s.id))
          setSelectedServiceIds((svc) => svc.filter((s) => !removed.has(s)))
        }
      }
      return next
    })
  }

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const persistIntent = useCallback(() => {
    if (typeof window === 'undefined') return
    const intent: BookingIntent = {
      branchId: activeBranchId,
      date: selectedDate ? toISODate(selectedDate) : null,
      time: selectedTime,
      serviceType,
      categoryIds: selectedCategoryIds,
      serviceIds: selectedServiceIds,
      notes,
    }
    sessionStorage.setItem(BOOKING_INTENT_KEY, JSON.stringify(intent))
  }, [
    activeBranchId,
    selectedDate,
    selectedTime,
    serviceType,
    selectedCategoryIds,
    selectedServiceIds,
    notes,
  ])

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || selectedServiceIds.length === 0) return

    // Step 1 cannot be passed without a branch, so this is only reached by a
    // restored booking at a time when no branch is taking bookings.
    if (!activeBranchId) {
      setSubmitError('Online booking is paused right now.')
      return
    }

    // Not signed in → email the request to the salon with the guest's details.
    if (!session?.user) {
      setSubmitting(true)
      setSubmitError(null)
      try {
        const res = await fetch('/api/booking-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: guestName.trim(),
            phone: guestPhone.trim(),
            email: guestEmail.trim(),
            branchId: activeBranchId,
            serviceType,
            bookingDate: toISODate(selectedDate),
            startTime: selectedTime,
            serviceIds: selectedServiceIds,
            notes: notes.trim() ? notes.trim() : undefined,
          }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          throw new Error(
            res.status === 400
              ? (json?.error?.message ?? 'Please check your details and try again.')
              : "Your booking couldn't be sent.",
          )
        }
        setIsSubmitted(true)
        track('booking_request_submitted', { bookingId: 'guest' })
      } catch (err: unknown) {
        setSubmitError(
          err instanceof Error ? err.message : "Your booking couldn't be sent. Please try again.",
        )
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranchId,
          serviceType,
          bookingDate: toISODate(selectedDate),
          startTime: selectedTime,
          serviceIds: selectedServiceIds,
          notes: notes.trim() ? notes.trim() : undefined,
        }),
      })
      const json = await res.json()

      // The customer skipped onboarding, so the server refused the booking.
      // Tapping Book Now normally sends them to onboarding before the dialog
      // opens (the homepage's requireProfileBeforeBooking); this is the
      // backstop for any other way in. Recoverable, not an error state: keep
      // the selections, remember the booking intent, and send them to finish
      // their profile. The dialog reopens automatically afterwards via `?book=1`.
      if (res.status === 403 && json?.error?.code === 'ONBOARDING_REQUIRED') {
        persistIntent()
        markBookingIntentForOnboarding()
        track('booking_onboarding_required')
        router.push(ONBOARDING_PATH)
        return
      }

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Your booking couldn't be submitted.")
      }
      setBookingNumber(json.data.bookingNumber as string)
      setIsSubmitted(true)
      track('booking_request_submitted', {
        bookingId: json.data.bookingNumber as string,
      })
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Your booking couldn't be submitted. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const canNext1 = Boolean(activeBranchId && selectedDate && selectedTime)
  const canNext2 = selectedCategoryIds.length > 0
  const canNext3 = selectedServiceIds.length > 0

  // Steps: 1 branch/date/time, 2 categories, 3 services, 4 details. A picked
  // service goes straight from 1 to 4.
  const stepOrder = servicePicked ? [1, 4] : [1, 2, 3, 4]
  const stepIndex = Math.max(0, stepOrder.indexOf(step))
  const goNext = () => setStep(stepOrder[stepIndex + 1] ?? 4)
  const goBack = () => setStep(stepOrder[stepIndex - 1] ?? 1)
  const pickedService =
    servicePicked && selectedServiceIds[0] ? servicesById.get(selectedServiceIds[0]) : undefined

  const selectedServices = selectedServiceIds
    .map((id) => servicesById.get(id))
    .filter((s): s is ApiService => Boolean(s))

  const primaryClass =
    'h-12 w-full rounded-full bg-ink font-ui text-[15px] font-semibold text-paper hover:bg-ink-soft disabled:bg-ink/30 disabled:text-paper disabled:opacity-100'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      // biome-ignore lint/a11y/useSemanticElements: custom modal with focus trap, aria-modal and Escape handling; native <dialog> would require showModal()/close() and break the overlay + animation.
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-dialog-title"
    >
      {/* Overlay */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close booking dialog"
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        className={`relative z-10 flex h-full w-full flex-col overflow-hidden bg-paper text-ink sm:h-auto sm:max-h-[92vh] sm:rounded-[20px] sm:shadow-elevated ${
          isSubmitted ? 'sm:max-w-lg' : 'sm:max-w-[920px] md:h-[min(700px,92vh)]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 md:px-8">
          <div className="flex min-w-0 items-baseline gap-4">
            <h2
              id="booking-dialog-title"
              className="font-display text-[24px] leading-none text-ink"
            >
              {isSubmitted ? 'Booking Submitted' : 'Book Appointment'}
            </h2>
            {!isSubmitted && (
              <div className="flex items-center gap-1.5" role="group">
                {/* Live text rather than an aria-label on a roleless div: the label would
                    not be exposed, and changing text is what actually gets announced as
                    the customer moves between steps. */}
                <span className="sr-only" aria-live="polite">
                  {`Step ${stepIndex + 1} of ${stepOrder.length}`}
                </span>
                {stepOrder.map((s, i) => (
                  <span
                    key={s}
                    aria-hidden="true"
                    className={`h-1 rounded-full motion-safe:transition-all duration-200 ${
                      i === stepIndex ? 'w-6 bg-ink' : i < stepIndex ? 'w-3 bg-ink' : 'w-3 bg-sand'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            className="rounded-full text-ink hover:bg-sand"
            aria-label="Close booking dialog"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        {isSubmitted ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <SuccessView bookingNumber={bookingNumber} onDone={handleClose} />
          </div>
        ) : (
          // Phones: one scrolling column (the step, then the ticket) above a
          // fixed action bar. md and up: the step on the left, the ticket and
          // its actions on the right. `md:contents` lets the scroll wrapper's
          // children join the grid directly.
          <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_360px] md:grid-rows-[minmax(0,1fr)_auto]">
            <div className="min-h-0 flex-1 overflow-y-auto md:contents">
              <div className="px-5 py-6 md:row-span-2 md:min-h-0 md:overflow-y-auto md:px-8">
                {step === 1 ? (
                  <Step1
                    branchList={branchList}
                    branchesError={branchesError}
                    activeBranchId={activeBranchId}
                    onSelectBranch={(id) => {
                      // Times are per branch, so a time picked for another one is dropped.
                      setSelectedBranchId(id)
                      setSelectedTime(null)
                    }}
                    onRetryBranches={() => setBranchesAttempt((n) => n + 1)}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    slots={slots}
                    slotsLoading={slotsLoading}
                    slotsError={slotsError}
                    onSelectDate={(d) => {
                      setSelectedDate(d)
                      setSelectedTime(null)
                    }}
                    onSelectTime={setSelectedTime}
                  />
                ) : step === 2 ? (
                  <Step2
                    serviceType={serviceType}
                    onServiceTypeChange={setServiceTypeAndReset}
                    categories={visibleCategories}
                    loading={servicesLoading}
                    error={servicesError}
                    selectedCategoryIds={selectedCategoryIds}
                    onToggleCategory={toggleCategory}
                  />
                ) : step === 3 ? (
                  <Step3
                    groupedCategories={groupedSelectedCategories}
                    selectedServiceIds={selectedServiceIds}
                    onToggleService={toggleService}
                  />
                ) : (
                  <Step4
                    notes={notes}
                    onNotesChange={setNotes}
                    submitError={submitError}
                    isSignedIn={Boolean(session?.user)}
                    guestName={guestName}
                    onGuestNameChange={setGuestName}
                    guestPhone={guestPhone}
                    onGuestPhoneChange={setGuestPhone}
                    guestEmail={guestEmail}
                    onGuestEmailChange={setGuestEmail}
                  />
                )}
              </div>

              <div className="px-5 pb-6 md:col-start-2 md:row-start-1 md:min-h-0 md:overflow-y-auto md:border-l md:border-hairline md:px-6 md:pt-6 md:pb-0">
                <AppointmentTicket
                  services={selectedServices}
                  serviceType={serviceType}
                  branch={activeBranch}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  totalPaise={totalPaise}
                  totalDuration={totalDuration}
                  onChangeService={pickedService ? () => setServicePicked(false) : undefined}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-hairline bg-paper px-5 py-4 md:col-start-2 md:row-start-2 md:border-l md:px-6 md:pb-6">
              {step > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={submitting}
                  className="h-12 shrink-0 rounded-full px-5 font-ui text-[15px] font-semibold text-ink hover:bg-sand"
                >
                  Back
                </Button>
              )}

              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => {
                    track('booking_step_completed', { step })
                    goNext()
                  }}
                  disabled={
                    (step === 1 && !canNext1) ||
                    (step === 2 && !canNext2) ||
                    (step === 3 && !canNext3)
                  }
                  className={`${primaryClass} flex-1`}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    selectedServiceIds.length === 0 ||
                    (!session?.user && (guestName.trim().length < 2 || !isLikelyPhone(guestPhone)))
                  }
                  aria-busy={submitting}
                  className={`${primaryClass} flex-1`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Submitting…
                    </>
                  ) : (
                    'Confirm booking'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Step Components ---

const EYEBROW = 'font-ui text-[11px] font-semibold uppercase tracking-[2px] text-gold-ink'
const SECTION_TITLE = 'mb-3 font-display text-[22px] leading-tight text-ink'
const MUTED = 'font-sans text-[14px] text-ink-muted'

function Loading({ label }: { label: string }) {
  return (
    <output className="flex items-center gap-2 py-4" aria-live="polite">
      <Loader2 className="size-4 animate-spin text-ink-muted" aria-hidden="true" />
      <span className={MUTED}>{label}</span>
    </output>
  )
}

// Step 1's branch row: a pill-styled native <select>, so screen readers and
// phones get the platform picker. Branches that are listed but not taking
// bookings are shown disabled with their status.
function BranchPicker({
  branchList,
  error,
  activeBranchId,
  onSelect,
  onRetry,
}: {
  branchList: PublicBranchList | null
  error: string | null
  activeBranchId: string | null
  onSelect: (id: string) => void
  onRetry: () => void
}) {
  if (!branchList) {
    return error ? (
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-sans text-[14px] text-error" role="alert">
          {error}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="rounded-full border-ink font-ui text-[13px] font-semibold text-ink"
        >
          Try again
        </Button>
      </div>
    ) : (
      <Loading label="Loading branches…" />
    )
  }

  // The list loaded but no branch is taking bookings.
  if (!activeBranchId) {
    return (
      <p className="font-sans text-[15px] text-ink" role="alert">
        Online booking is paused right now. Please call us on +91 81483 08344.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label htmlFor="booking-branch" className={EYEBROW}>
        Branch
      </label>
      <div className="relative">
        {/* The selected branch is always one taking bookings, hence the green dot. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-2 -translate-y-1/2 rounded-full bg-success"
        />
        <select
          id="booking-branch"
          value={activeBranchId}
          onChange={(e) => onSelect(e.target.value)}
          className="h-10 cursor-pointer appearance-none rounded-full border border-hairline bg-white pr-9 pl-8 font-ui text-[14px] font-medium text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 motion-safe:transition-colors motion-safe:duration-200"
        >
          {branchList.branches.map((b) => (
            <option key={b.id} value={b.id} disabled={!b.acceptingBookings}>
              {b.acceptingBookings
                ? branchLabel(b)
                : `${branchLabel(b)} (${BRANCH_STATUS_LABEL[b.status]})`}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </div>
  )
}

// "November" or "November – December" when the fortnight crosses a month.
function monthSpan(days: Date[]): string {
  const name = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long' })
  const first = days[0]
  const last = days[days.length - 1]
  if (!first || !last) return ''
  return name(first) === name(last) ? name(first) : `${name(first)} – ${name(last)}`
}

function Step1({
  branchList,
  branchesError,
  activeBranchId,
  onSelectBranch,
  onRetryBranches,
  selectedDate,
  selectedTime,
  slots,
  slotsLoading,
  slotsError,
  onSelectDate,
  onSelectTime,
}: {
  branchList: PublicBranchList | null
  branchesError: string | null
  activeBranchId: string | null
  onSelectBranch: (id: string) => void
  onRetryBranches: () => void
  selectedDate: Date | null
  selectedTime: string | null
  slots: AvailabilitySlot[]
  slotsLoading: boolean
  slotsError: string | null
  onSelectDate: (d: Date) => void
  onSelectTime: (t: string) => void
}) {
  const days = getNext14Days()
  const branchesLoading = !branchList && !branchesError

  const branchPicker = (
    <BranchPicker
      branchList={branchList}
      error={branchesError}
      activeBranchId={activeBranchId}
      onSelect={onSelectBranch}
      onRetry={onRetryBranches}
    />
  )

  // No branch is taking bookings: the picker's notice is all there is to show.
  if (branchList && !activeBranchId) {
    return branchPicker
  }

  return (
    <div className="space-y-8">
      {branchPicker}

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[22px] leading-tight text-ink">Select Date</h3>
          <span className={EYEBROW}>{monthSpan(days)}</span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2">
          {days.map((d) => {
            const isSelected = selectedDate?.toDateString() === d.toDateString()
            return (
              <button
                // Keyed by calendar day. `toISOString()` included the current
                // time, so re-renders remounted the buttons and a keyboard
                // user lost focus on the date they had just picked.
                key={toISODate(d)}
                type="button"
                onClick={() => onSelectDate(d)}
                aria-label={formatLongDate(d)}
                className={`flex h-[68px] w-[58px] flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] border motion-safe:transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 ${
                  isSelected
                    ? 'border-ink bg-ink text-paper'
                    : 'border-hairline bg-white text-ink hover:border-ink'
                }`}
                aria-pressed={isSelected}
              >
                <span
                  className={`font-ui text-[10px] font-semibold uppercase tracking-[1.5px] ${
                    isSelected ? 'text-paper/70' : 'text-ink-muted'
                  }`}
                >
                  {formatDay(d)}
                </span>
                <span className="font-display text-[24px] leading-none">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className={SECTION_TITLE}>Select Time</h3>

        {!selectedDate ? (
          <p className={MUTED}>Pick a date to see available times.</p>
        ) : !activeBranchId && branchesLoading ? (
          <Loading label="Loading available times…" />
        ) : !activeBranchId ? (
          <p className={MUTED}>Available times appear once a branch is selected.</p>
        ) : slotsLoading ? (
          <Loading label="Loading available times…" />
        ) : slotsError ? (
          <p className="font-sans text-[14px] text-error" role="alert">
            {slotsError}
          </p>
        ) : slots.length === 0 ? (
          <p className={MUTED}>No slots available for this date. Try another day.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const isSelected = selectedTime === slot.startTime
              return (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => slot.available && onSelectTime(slot.startTime)}
                  disabled={!slot.available}
                  aria-pressed={isSelected}
                  aria-disabled={!slot.available}
                  className={`h-10 min-w-[76px] rounded-full border px-4 font-ui text-[14px] font-medium motion-safe:transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 ${
                    isSelected
                      ? 'border-ink bg-ink text-paper'
                      : slot.available
                        ? 'border-hairline bg-white text-ink hover:border-ink'
                        : 'cursor-not-allowed border-transparent bg-sand/60 text-ink-muted line-through'
                  }`}
                >
                  {slot.startTime}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const CHOICE_ROW =
  'flex cursor-pointer items-center gap-3 rounded-[14px] border p-4 motion-safe:transition-colors duration-200'

function Step2({
  serviceType,
  onServiceTypeChange,
  categories,
  loading,
  error,
  selectedCategoryIds,
  onToggleCategory,
}: {
  serviceType: ServiceType
  onServiceTypeChange: (t: ServiceType) => void
  categories: ApiCategory[]
  loading: boolean
  error: string | null
  selectedCategoryIds: string[]
  onToggleCategory: (id: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className={SECTION_TITLE}>Service Type</h3>
        <div
          className="inline-flex gap-1 rounded-full border border-hairline bg-white p-1"
          role="radiogroup"
          aria-label="Service type"
        >
          {(['salon', 'spa'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              // biome-ignore lint/a11y/useSemanticElements: intentional ARIA radiogroup of styled pill buttons; native <input type="radio"> cannot carry this pill styling.
              role="radio"
              aria-checked={serviceType === t}
              variant="ghost"
              size="sm"
              onClick={() => onServiceTypeChange(t)}
              className={`h-9 rounded-full px-5 font-ui text-[14px] font-semibold ${
                serviceType === t
                  ? 'bg-ink text-paper hover:bg-ink hover:text-paper'
                  : 'text-ink hover:bg-sand'
              }`}
            >
              {t === 'spa' ? 'Spa' : 'Salon'}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className={SECTION_TITLE}>Categories</h3>

        {loading ? (
          <Loading label="Loading categories…" />
        ) : error ? (
          <p className="font-sans text-[14px] text-error" role="alert">
            {error}
          </p>
        ) : categories.length === 0 ? (
          <p className={MUTED}>
            No {serviceType === 'spa' ? 'spa' : 'salon'} categories available right now.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((cat) => {
              const isChecked = selectedCategoryIds.includes(cat.id)
              return (
                <label
                  key={cat.id}
                  className={`${CHOICE_ROW} ${
                    isChecked ? 'border-ink bg-white' : 'border-hairline bg-white hover:border-ink'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleCategory(cat.id)}
                    className="size-4 accent-ink"
                  />
                  <span className="font-ui text-[15px] font-medium text-ink">{cat.name}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Step3({
  groupedCategories,
  selectedServiceIds,
  onToggleService,
}: {
  groupedCategories: ApiCategory[]
  selectedServiceIds: string[]
  onToggleService: (id: string) => void
}) {
  const hasServices = groupedCategories.some((c) => c.services.length > 0)

  return (
    <div className="space-y-6">
      <h3 className="font-display text-[22px] leading-tight text-ink">Select Services</h3>

      {!hasServices && <p className={MUTED}>No services found for the selected categories.</p>}

      {groupedCategories.map((cat) => (
        <div key={cat.id} className="space-y-2">
          <h4 className={EYEBROW}>{cat.name}</h4>
          {cat.services.map((svc) => {
            const isChecked = selectedServiceIds.includes(svc.id)
            return (
              <label
                key={svc.id}
                className={`${CHOICE_ROW} justify-between ${
                  isChecked ? 'border-ink bg-white' : 'border-hairline bg-white hover:border-ink'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleService(svc.id)}
                    className="size-4 accent-ink"
                  />
                  <div>
                    <span className="font-ui text-[15px] font-medium text-ink">{svc.name}</span>
                    <span className="block font-sans text-[13px] text-ink-muted">
                      {svc.durationMinutes} min
                    </span>
                  </div>
                </div>
                <span className="font-ui text-[15px] font-semibold text-ink">
                  {formatINR(svc.pricePaise)}
                </span>
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Step4({
  notes,
  onNotesChange,
  submitError,
  isSignedIn,
  guestName,
  onGuestNameChange,
  guestPhone,
  onGuestPhoneChange,
  guestEmail,
  onGuestEmailChange,
}: {
  notes: string
  onNotesChange: (v: string) => void
  submitError: string | null
  isSignedIn: boolean
  guestName: string
  onGuestNameChange: (v: string) => void
  guestPhone: string
  onGuestPhoneChange: (v: string) => void
  guestEmail: string
  onGuestEmailChange: (v: string) => void
}) {
  const inputClass =
    'h-12 w-full rounded-[12px] border border-hairline bg-white px-4 font-sans text-[15px] text-ink placeholder:text-ink-muted/70 focus:border-ink focus:outline-none'
  const labelClass = 'mb-2 block font-ui text-[13px] font-semibold text-ink'
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-[22px] leading-tight text-ink">Your details</h3>
        <p className={`mt-1 ${MUTED}`}>Check your appointment, then tell us who's coming.</p>
      </div>

      {!isSignedIn && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="booking-name" className={labelClass}>
              Name
            </label>
            <input
              id="booking-name"
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              value={guestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              placeholder="Your full name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="booking-phone" className={labelClass}>
              Phone / WhatsApp
            </label>
            <input
              id="booking-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={16}
              value={guestPhone}
              onChange={(e) => onGuestPhoneChange(e.target.value)}
              placeholder="10-digit mobile number"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="booking-email" className={labelClass}>
              Email (optional)
            </label>
            <input
              id="booking-email"
              type="email"
              autoComplete="email"
              maxLength={120}
              value={guestEmail}
              onChange={(e) => onGuestEmailChange(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="booking-notes" className={labelClass}>
          Notes (optional)
        </label>
        <textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Any special requests..."
          className="w-full resize-none rounded-[12px] border border-hairline bg-white px-4 py-3 font-sans text-[15px] text-ink placeholder:text-ink-muted/70 focus:border-ink focus:outline-none"
        />
      </div>

      {submitError && (
        <div
          className="rounded-[12px] border border-error/40 bg-error/5 px-4 py-3"
          role="alert"
          aria-live="polite"
        >
          <p className="font-sans text-[14px] text-error">{submitError}</p>
          <p className="mt-1 font-sans text-[13px] text-ink-muted">
            Or call / WhatsApp us:{' '}
            <a href="https://wa.me/918148308344" className="underline">
              +91 81483 08344
            </a>
          </p>
        </div>
      )}

      <p className="font-sans text-[13px] text-ink-muted">
        {isSignedIn
          ? 'Payment is collected at the salon. You will receive a confirmation once your booking is approved.'
          : 'Payment is collected at the salon. We will call or WhatsApp you to confirm your booking.'}
      </p>
    </div>
  )
}

// The right-hand "ticket": what the customer is booking so far, filled in
// as they go. Its dashed tear line has a notch cut into each side.
function AppointmentTicket({
  services,
  serviceType,
  branch,
  selectedDate,
  selectedTime,
  totalPaise,
  totalDuration,
  onChangeService,
}: {
  services: ApiService[]
  serviceType: ServiceType
  branch: PublicBranch | null
  selectedDate: Date | null
  selectedTime: string | null
  totalPaise: number
  totalDuration: number
  onChangeService?: (() => void) | undefined
}) {
  const [first, ...rest] = services
  const row = 'flex items-baseline justify-between gap-4 py-2.5'
  const label = 'font-sans text-[14px] text-ink-muted'
  const value = 'text-right font-ui text-[15px] font-semibold text-ink'

  return (
    <section
      aria-label="Booking Summary"
      className="relative overflow-hidden rounded-[18px] border border-hairline bg-white"
    >
      <div className="px-6 pt-6 pb-5">
        <p className={EYEBROW}>Your appointment</p>
        {first ? (
          <>
            <p className="mt-2 font-display text-[28px] leading-[1.1] text-ink">{first.name}</p>
            {rest.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {rest.map((svc) => (
                  <li key={svc.id} className="font-display text-[20px] leading-snug text-ink">
                    + {svc.name}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 font-display text-[28px] leading-[1.1] text-ink-muted/60">
            Your {serviceType === 'spa' ? 'spa' : 'salon'} visit
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="font-sans text-[14px] text-ink-muted">with the WeCut team</p>
          {onChangeService && (
            <button
              type="button"
              onClick={onChangeService}
              className="min-h-[44px] font-ui text-[13px] font-semibold text-ink underline underline-offset-4"
            >
              Change
            </button>
          )}
        </div>
      </div>

      <div aria-hidden="true" className="relative h-0">
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full border border-hairline bg-paper" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full border border-hairline bg-paper" />
        <span className="absolute inset-x-6 top-0 border-t border-dashed border-hairline" />
      </div>

      <dl className="px-6 pt-4 pb-5">
        <div className={row}>
          <dt className={label}>Date</dt>
          <dd className={value}>{selectedDate ? formatTicketDate(selectedDate) : '—'}</dd>
        </div>
        <div className={row}>
          <dt className={label}>Time</dt>
          <dd className={value}>{selectedTime ? formatTime12h(selectedTime) : '—'}</dd>
        </div>
        <div className={row}>
          <dt className={label}>Branch</dt>
          <dd className={value}>{branch ? branchLabel(branch) : '—'}</dd>
        </div>
        {totalDuration > 0 && (
          <div className={row}>
            <dt className={label}>Duration</dt>
            <dd className={value}>~{totalDuration} min</dd>
          </div>
        )}
        <div className={`${row} mt-2 border-t border-hairline pt-4`}>
          <dt className="font-ui text-[15px] font-semibold text-ink">Total</dt>
          <dd className="font-display text-[26px] leading-none text-ink">
            {totalPaise > 0 ? formatINR(totalPaise) : '—'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function SuccessView({
  bookingNumber,
  onDone,
}: {
  bookingNumber: string | null
  onDone: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-ink text-paper">
        <Check className="size-8" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <h3 className="mb-2 font-display text-[28px] text-ink">Booking Submitted!</h3>
      <p className="mb-6 max-w-xs font-sans text-[15px] text-ink-soft">
        Our team will confirm your appointment shortly.
      </p>

      {bookingNumber && (
        <div className="mb-8 rounded-[14px] border border-hairline bg-white px-6 py-4">
          <span className={`mb-1 block ${EYEBROW}`}>Booking Number</span>
          <span className="font-ui text-[17px] font-semibold tracking-[0.5px] text-ink">
            {bookingNumber}
          </span>
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        {bookingNumber && (
          <Button
            asChild
            className="h-12 rounded-full bg-ink font-ui text-[15px] font-semibold text-paper hover:bg-ink-soft"
          >
            <a href="/bookings">View My Bookings</a>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={onDone}
          className="h-12 rounded-full border border-hairline font-ui text-[15px] font-semibold text-ink hover:bg-sand"
        >
          Done
        </Button>
      </div>
    </div>
  )
}
