-- Keep confirmed booking history from being deleted through event type cascade.
-- Directly deleting an event type with bookings now fails atomically through the
-- foreign key, while deferral lets account/profile cascades clean up dependent
-- bookings in the same transaction.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_event_type_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_event_type_id_fkey
  FOREIGN KEY (event_type_id)
  REFERENCES public.event_types(id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;
