'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { eventTypeSchema, type EventTypeFormValues } from '@/lib/validations/event-type'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Tables } from '@/lib/types/database'

interface EventTypeFormProps {
  mode: 'create' | 'edit'
  initialData?: EventTypeFormValues
  eventTypeId?: string
}

export function EventTypeForm({ mode, initialData, eventTypeId }: EventTypeFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EventTypeFormValues>({
    resolver: zodResolver(eventTypeSchema),
    defaultValues: initialData ?? {
      title: '',
      slug: '',
      description: '',
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 60,
      max_booking_days_ahead: 60,
      location_type: 'online',
      location_value: '',
      is_active: true,
    },
  })

  async function onSubmit(data: EventTypeFormValues) {
    setIsSubmitting(true)
    setServerError('')

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setServerError('You must be logged in.')
        return
      }

      // Get the user's profile ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      const profile = profileData as Pick<Tables<'profiles'>, 'id'> | null

      if (!profile) {
        setServerError('Profile not found. Please complete your profile first.')
        return
      }

      if (mode === 'create') {
        const { error } = await (supabase.from('event_types') as any).insert({
          user_id: profile.id,
          title: data.title,
          slug: data.slug,
          description: data.description ?? '',
          duration_minutes: data.duration_minutes,
          buffer_before_minutes: data.buffer_before_minutes,
          buffer_after_minutes: data.buffer_after_minutes,
          min_notice_minutes: data.min_notice_minutes,
          max_booking_days_ahead: data.max_booking_days_ahead,
          location_type: data.location_type,
          location_value: data.location_value ?? '',
          is_active: data.is_active,
        })

        if (error) {
          if (error.code === '23505' && error.message.includes('slug')) {
            setServerError('An event type with a similar title already exists. Please choose a different title.')
          } else {
            setServerError('Failed to create event type. Please try again.')
          }
          return
        }
      } else {
        // Edit mode
        const { error } = await (supabase
          .from('event_types') as any)
          .update({
            title: data.title,
            slug: data.slug,
            description: data.description ?? '',
            duration_minutes: data.duration_minutes,
            buffer_before_minutes: data.buffer_before_minutes,
            buffer_after_minutes: data.buffer_after_minutes,
            min_notice_minutes: data.min_notice_minutes,
            max_booking_days_ahead: data.max_booking_days_ahead,
            location_type: data.location_type,
            location_value: data.location_value ?? '',
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventTypeId!)
      
        if (error) {
          setServerError('Failed to update event type. Please try again.')
          return
        }
      }

      router.push('/event-types')
      router.refresh()
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. 30 Minute Meeting"
          {...register('title')}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        {errors.title && (
          <p id="title-error" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL Slug</Label>
        <Input
          id="slug"
          placeholder="e.g. 30-minute-meeting"
          {...register('slug')}
          aria-invalid={!!errors.slug}
          aria-describedby={errors.slug ? 'slug-error' : undefined}
        />
        {errors.slug && (
          <p id="slug-error" className="text-sm text-destructive">
            {errors.slug.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          placeholder="Brief description of this event type"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('description')}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        {errors.description && (
          <p id="description-error" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input
            id="duration_minutes"
            type="number"
            min={1}
            {...register('duration_minutes', { valueAsNumber: true })}
            aria-invalid={!!errors.duration_minutes}
            aria-describedby={errors.duration_minutes ? 'duration-error' : undefined}
          />
          {errors.duration_minutes && (
            <p id="duration-error" className="text-sm text-destructive">
              {errors.duration_minutes.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="buffer_before_minutes">Buffer Before (minutes)</Label>
          <Input
            id="buffer_before_minutes"
            type="number"
            min={0}
            {...register('buffer_before_minutes', { valueAsNumber: true })}
            aria-invalid={!!errors.buffer_before_minutes}
            aria-describedby={errors.buffer_before_minutes ? 'buffer-before-error' : undefined}
          />
          {errors.buffer_before_minutes && (
            <p id="buffer-before-error" className="text-sm text-destructive">
              {errors.buffer_before_minutes.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="buffer_after_minutes">Buffer After (minutes)</Label>
          <Input
            id="buffer_after_minutes"
            type="number"
            min={0}
            {...register('buffer_after_minutes', { valueAsNumber: true })}
            aria-invalid={!!errors.buffer_after_minutes}
            aria-describedby={errors.buffer_after_minutes ? 'buffer-after-error' : undefined}
          />
          {errors.buffer_after_minutes && (
            <p id="buffer-after-error" className="text-sm text-destructive">
              {errors.buffer_after_minutes.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_notice_minutes">Minimum Notice (minutes)</Label>
          <Input
            id="min_notice_minutes"
            type="number"
            min={0}
            {...register('min_notice_minutes', { valueAsNumber: true })}
            aria-invalid={!!errors.min_notice_minutes}
            aria-describedby={errors.min_notice_minutes ? 'min-notice-error' : undefined}
          />
          {errors.min_notice_minutes && (
            <p id="min-notice-error" className="text-sm text-destructive">
              {errors.min_notice_minutes.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_booking_days_ahead">Max Booking Days Ahead</Label>
          <Input
            id="max_booking_days_ahead"
            type="number"
            min={1}
            {...register('max_booking_days_ahead', { valueAsNumber: true })}
            aria-invalid={!!errors.max_booking_days_ahead}
            aria-describedby={errors.max_booking_days_ahead ? 'max-days-error' : undefined}
          />
          {errors.max_booking_days_ahead && (
            <p id="max-days-error" className="text-sm text-destructive">
              {errors.max_booking_days_ahead.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location_type">Location Type</Label>
          <Controller
            name="location_type"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="location_type" aria-invalid={!!errors.location_type}>
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.location_type && (
            <p className="text-sm text-destructive">
              {errors.location_type.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location_value">Location Details</Label>
          <Input
            id="location_value"
            placeholder="e.g. Zoom link, phone number, address"
            {...register('location_value')}
            aria-invalid={!!errors.location_value}
            aria-describedby={errors.location_value ? 'location-value-error' : undefined}
          />
          {errors.location_value && (
            <p id="location-value-error" className="text-sm text-destructive">
              {errors.location_value.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="is_active"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          {...register('is_active')}
        />
        <Label htmlFor="is_active">Active (visible on public booking page)</Label>
      </div>

      {serverError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {serverError}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create' ? 'Creating...' : 'Saving...'
            : mode === 'create' ? 'Create Event Type' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/event-types')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
