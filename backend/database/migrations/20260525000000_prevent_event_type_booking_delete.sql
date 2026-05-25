-- Keep confirmed booking history from being deleted through event type cascade.
-- Deleting an event type with bookings now fails atomically through the foreign
-- key instead of relying on a route-level preflight count.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_event_type_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_event_type_id_fkey
  FOREIGN KEY (event_type_id)
  REFERENCES public.event_types(id)
  ON DELETE RESTRICT;
