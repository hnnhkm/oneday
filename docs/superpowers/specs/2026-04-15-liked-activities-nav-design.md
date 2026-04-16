# Liked Activities — Nav Discoverability Design

## Problem

The `/favorites` page already exists and works (flat grid of liked activities,
with empty state). But it's hard to find:

- **Mobile**: not in the bottom tab bar at all — only reachable via the user
  menu dropdown.
- **Desktop**: present in the header as a text link "Favorites" + duplicated
  in the user menu dropdown. Functional, but doesn't visually connect to the
  heart icon users tap on every activity card.

This spec covers nav placement only. The favorites page itself is unchanged.

## Mobile

Add a 5th bottom-nav tab between Browse and Bookings:

```
🏠 Home   🔍 Browse   ❤️ Liked   📋 Bookings   👤 Settings
```

Reasoning: Liked sits adjacent to Browse, mirroring the discover → save flow.
Five tabs is the comfortable max across Instagram/TikTok/Twitter.

### Instructor case

Approved instructors currently get a 5th tab (`🎨 Instructor`). Adding Liked
would push them to 6 tabs, which is too cramped on iPhone SE-class screens.

**Solution: hide the Home tab for approved instructors.** Their natural
landing surface is Browse or the Instructor dashboard; Home is low-signal for
them. Final order:

```
🔍 Browse   ❤️ Liked   📋 Bookings   🎨 Instructor   👤 Settings
```

This keeps both flows at exactly 5 tabs.

## Desktop

Replace the header's text link "Favorites" with a heart icon next to the
language switcher:

```
[logo]   Bookings        🌐  ❤️  [avatar ▾]
```

- The icon visually closes the loop: heart on activity card → heart in nav
  shows what was saved. (Airbnb / Pinterest pattern.)
- Heart icon should match the current `FavoriteButton` chip-variant heart
  (filled red `text-red-500 fill-current`) so the user recognizes it as the
  same affordance.
- "Bookings" stays as a text link — operational/transactional, less iconic.
- The duplicate "Favorites" item in the user-menu dropdown stays for
  keyboard-only users and anyone who misses the icon.
- Hover/focus state and aria-label use the existing `nav.favorites`
  translation key so screen readers announce "Favorites" / "Favoritos" /
  "Favoritos".

## Files Touched

- `src/components/layout/mobile-nav.tsx` — add Liked tab; hide Home for
  approved instructors
- `src/components/layout/header.tsx` — remove "Favorites" text link; render
  a heart-icon link in the right cluster (visible to logged-in users only)

No new translation keys (we already have `nav.favorites`). No DB changes,
no new server actions, no changes to the favorites page itself.

## Out of Scope

- Tabs / filters / sorting on the favorites page
- Wishlists / collections (à la Airbnb's named lists)
- Notifications when a saved activity hits low availability
