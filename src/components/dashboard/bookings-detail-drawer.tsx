"use client"

import {
  Calendar,
  Clock,
  FileText,
  Globe,
  type LucideIcon,
  Mail,
  MessageSquare,
  Video,
} from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { Booking } from "@/lib/booking-utils"
import { formatBookingLocationLabel } from "@/lib/location-labels"
import { formatBookingAnswerValue } from "@/lib/validations/invitee-questions"
import { formatBookingDateTime } from "@/components/dashboard/bookings-format"
import { useDashboardDisplayPreferences } from "@/components/dashboard/display-preferences-provider"
import type { DashboardDisplayPreferences } from "@/lib/dashboard/display-preferences"

interface BookingDetailsDrawerProps {
  booking: Booking | null
  open: boolean
  onClose: () => void
  onCancelBooking: () => void
}

export function BookingDetailsDrawer({
  booking,
  open,
  onClose,
  onCancelBooking,
}: BookingDetailsDrawerProps) {
  const displayPreferences = useDashboardDisplayPreferences()

  return (
    <Drawer open={open} onClose={onClose} title="Booking Details">
      <DrawerHeader>
        <DrawerTitle>Booking Details</DrawerTitle>
        <DrawerDescription>Full details for this booking.</DrawerDescription>
      </DrawerHeader>
      <DrawerContent>
        {booking && (
          <BookingDetails
            booking={booking}
            displayPreferences={displayPreferences}
          />
        )}
      </DrawerContent>
      <DrawerFooter>
        {booking?.status === "confirmed" &&
          new Date(booking.start_at) > new Date() && (
            <Button variant="destructive" onClick={onCancelBooking}>
              Cancel booking
            </Button>
          )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}

function BookingDetails({
  booking,
  displayPreferences,
}: {
  booking: Booking
  displayPreferences: DashboardDisplayPreferences
}) {
  const locationLabel = bookingLocationLabel(booking)
  const statusText = conferenceStatusText(booking)
  const formattedStart = formatBookingDateTime(
    booking.start_at,
    displayPreferences
  )
  const formattedEnd = formatBookingDateTime(
    booking.end_at,
    displayPreferences
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <span className="text-sm font-medium">
            {booking.guest_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-medium">{booking.guest_name}</p>
          <p className="text-sm text-muted-foreground">{booking.guest_email}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <BookingDetailRow icon={Calendar}>
          {booking.event_type_title}
        </BookingDetailRow>
        <BookingDetailRow icon={Clock}>
          Your time · {displayPreferences.timezone}: {formattedStart.date} ·{" "}
          {formattedStart.time} – {formattedEnd.time}
        </BookingDetailRow>
        <BookingDetailRow icon={Globe}>
          Guest timezone: {booking.guest_timezone}
        </BookingDetailRow>
        <BookingDetailRow icon={Mail}>{booking.guest_email}</BookingDetailRow>
        {locationLabel && (
          <BookingDetailRow icon={Video}>{locationLabel}</BookingDetailRow>
        )}
        {booking.conference_url && (
          <BookingDetailRow icon={Video}>
            <a
              href={booking.conference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open meeting link
            </a>
          </BookingDetailRow>
        )}
        {!booking.conference_url && statusText && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {statusText}
          </div>
        )}
        {booking.notes && (
          <BookingDetailRow icon={FileText} align="start">
            {booking.notes}
          </BookingDetailRow>
        )}
        {(booking.booking_answers?.length ?? 0) > 0 && (
          <BookingDetailRow icon={MessageSquare} align="start">
            <div className="space-y-2">
              {booking.booking_answers?.map((answer) => (
                <div key={answer.questionId}>
                  <p className="font-medium">{answer.label}</p>
                  <p className="text-muted-foreground">
                    {formatBookingAnswerValue(answer)}
                  </p>
                </div>
              ))}
            </div>
          </BookingDetailRow>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Badge variant={bookingStatusBadgeVariant(booking)}>
          {bookingStatusLabel(booking)}
        </Badge>
      </div>
    </div>
  )
}

interface BookingDetailRowProps {
  icon: LucideIcon
  align?: "center" | "start"
  children: ReactNode
}

function BookingDetailRow({
  icon: Icon,
  align = "center",
  children,
}: BookingDetailRowProps) {
  return (
    <div
      className={
        align === "start" ? "flex items-start gap-2" : "flex items-center gap-2"
      }
    >
      <Icon
        className={
          align === "start"
            ? "mt-0.5 h-4 w-4 text-muted-foreground"
            : "h-4 w-4 text-muted-foreground"
        }
        aria-hidden="true"
      />
      <div className="text-sm">{children}</div>
    </div>
  )
}

function bookingLocationLabel(booking: Booking): string | null {
  return formatBookingLocationLabel({
    locationType: booking.location_type,
    locationValue: booking.location_value,
    conferenceProvider: booking.conference_provider,
  })
}

function conferenceStatusText(booking: Booking): string | null {
  if (!booking.conference_provider || booking.conference_status === "ready") {
    return null
  }

  if (booking.conference_status === "setup_required") {
    return booking.conference_error ?? "Video provider setup is required."
  }

  if (booking.conference_status === "failed") {
    return booking.conference_error ?? "Meeting link generation failed."
  }

  return "Meeting link generation is pending."
}

function bookingStatusBadgeVariant(
  booking: Booking
): ComponentProps<typeof Badge>["variant"] {
  if (booking.status === "confirmed") return "success"
  if (booking.status === "cancelled") return "danger"
  return "secondary"
}

function bookingStatusLabel(booking: Booking) {
  if (booking.status !== "confirmed") return "Cancelled"
  return new Date(booking.start_at) > new Date() ? "Confirmed" : "Completed"
}
