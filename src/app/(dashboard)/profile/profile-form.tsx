'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileSchema, type ProfileFormValues, getTimezones } from '@/lib/validations/profile'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ProfileFormProps {
  initialData: ProfileFormValues
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialData,
  })

  const timezones = getTimezones()
  const currentTimezone = watch('default_timezone')

  async function onSubmit(data: ProfileFormValues) {
    setIsSubmitting(true)
    setSuccessMessage('')
    setServerError('')

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setServerError('You must be logged in to update your profile.')
        return
      }

      const { error } = await (supabase
        .from('profiles') as any)
        .update({
          name: data.name,
          username: data.username,
          default_timezone: data.default_timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('auth_user_id', user.id)

      if (error) {
        if (error.code === '23505' && error.message.includes('username')) {
          setServerError('This username is already taken. Please choose another.')
        } else {
          setServerError('Failed to update profile. Please try again.')
        }
        return
      }

      setSuccessMessage('Profile updated successfully.')
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
        <CardDescription>
          Update your public profile information. Your username will be used in your public booking URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your full name"
              {...register('name')}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="your-username"
              {...register('username')}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : 'username-hint'}
            />
            <p id="username-hint" className="text-sm text-muted-foreground">
              Your public URL will be: /
              {watch('username') || 'your-username'}
            </p>
            {errors.username && (
              <p id="username-error" className="text-sm text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_timezone">Default Timezone</Label>
            <select
              id="default_timezone"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
              value={currentTimezone}
              onChange={(e) => setValue('default_timezone', e.target.value, { shouldValidate: true })}
              aria-invalid={!!errors.default_timezone}
              aria-describedby={errors.default_timezone ? 'timezone-error' : undefined}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {errors.default_timezone && (
              <p id="timezone-error" className="text-sm text-destructive">
                {errors.default_timezone.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {serverError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success" role="status">
              {successMessage}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
