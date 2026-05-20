# UI/UX Audit

## Top usability issues

- Login feels disconnected from the more polished signup experience.
- Dashboard pages use different header, filter, and action patterns, so common workflows feel less predictable.
- Empty states are often plain text and do not always provide a clear next step.
- Booking slot selection has basic loading and error states, but the guest is not always guided toward the next best action.
- Destructive settings actions still rely on browser confirmation dialogs instead of product-styled confirmation flows.

## Visual polish issues

- Cards, controls, and page sections vary in spacing, radius, and hierarchy.
- Dashboard content can feel dense because metrics, list cards, and action bars have similar visual weight.
- Button copy mixes title case, sentence case, arrows, and icon placement.
- The landing hero proof row reads as placeholder-like because the avatar dots are blank.
- Public booking/profile pages feel visually thinner than the landing and signup experience.

## Accessibility issues

- Some clickable table rows and cards use role/button behavior instead of native interactive elements.
- Several async states are only visual and are not announced with `aria-live`.
- Focus styles exist, but the strength and consistency vary across shared primitives and custom controls.
- Filter controls would be clearer with selected-state semantics and result counts.
- Mobile navigation works, but active/focus affordances could be stronger.

## Quick wins

- Tighten shared button, card, input, textarea, badge, and empty-state styles.
- Add richer empty states with icons, copy, and primary/secondary next actions.
- Unify dashboard page headers and filter bars.
- Bring login up to the signup page's polish level.
- Improve booking loading, empty, and error states with clearer guidance.
- Add status spinners and `aria-live` text to mutating actions.

## Larger improvements worth doing later

- Replace settings `window.confirm` calls with accessible app dialogs.
- Add route-level skeleton loading for dashboard/public booking surfaces.
- Add authenticated demo fixtures for visual regression testing.
- Add a graceful local-development fallback for missing Butterbase environment variables on public routes.
- Introduce a small dashboard page layout helper for page titles, actions, and filter bars.
