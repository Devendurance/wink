# Design System Inspired by Gift Box Site (working title)

> Sources: **A** = dark hero with three tilted gradient cards (layout + overall feel). **B** = white-frame mascot picker with one dark feature card and four candy-colour cards (overall feel + mascot section). **C** = glowing faceted glass orb on night-navy (gift reveal glow, sparkle, particles). **D** = lavender 3D gift box with confetti and an OPEN button (gift box rendering). A and B set the aesthetic; C and D only inform how the gift boxes and the opening moment look.
>
> **Font lock:** Georama + Satoshi are the only two typefaces. Anywhere the references show an Inter-style grotesque (C and D UI text, B body copy), use Satoshi. Anywhere a display or heading face is needed, use Georama. Inter is never used, not even as a fallback.

---

## 1. Visual Theme & Atmosphere

A stage-lit toy shop after dark. The canvas is pure black with faint flowing contour lines, and on it saturated candy-gradient cards and inflated, glossy 3D objects glow like collectibles under a spotlight. The headline is huge, light-weight and airy, which gives it the confidence of a premium crypto hero, while the cute round-eyed mascots and the gift boxes keep the mood playful and rewarding. Midway down, the page flips to one bright white "sheet" holding the mascot picker, then returns to dark. The gift opening itself happens on a deep night-navy stage with sparkle, so every open feels like a small ceremony.

**Key Characteristics**
- Near-black canvas (`#050505`) with ultra-faint wave/contour linework. The darkness exists to make colour glow.
- Cards are full-saturation gradients (cyan→blue, white→orange→pink, blue→violet→coral) with a fine grain overlay, never flat fills.
- Hero cards are fanned: left tilted about -14°, centre upright and raised, right tilted about +12°, overlapping, and bleeding off the bottom of the first viewport.
- Every object is soft 3D clay or plastic: inflated, rounded, glossy, lit from the top-left. Gift boxes and mascots share this one rendering language.
- Mascots have glossy black oval eyes with two white specular dots, tone-on-tone blush cheeks and a tiny mouth. Cuteness is built from three marks only.
- Candy accent spectrum (violet, pink, cyan, lime, orange) used as card fills. Each card is one colour, and the object inside never matches its own card.
- Pill buttons everywhere (fully rounded), with large 24–40px radii on cards and a 40px radius on the white frame.
- Headline type is light and wide (Georama 500). UI type is small, clean and quiet (Satoshi). Contrast in weight and scale does the hierarchy work.
- One white "frame" section breaks the dark rhythm exactly once per page.

---

## 2. Color Palette & Roles

### Primary
| Name | Hex | Usage |
|---|---|---|
| Void Black | `#050505` | Page background, hero, nav ground. |
| Pure White | `#FFFFFF` | Headlines on dark, the white frame section, pill buttons on coloured cards. |
| Ember Orange | `#FF6A2C` | Brand CTA colour and the base of the centre hero card. |
| Ember Gradient | `linear-gradient(90deg, #FF5A1F 0%, #FF9A4D 100%)` | The one marketing CTA pill per view (nav "Contact us" style button). |
| Gift Periwinkle | `#6C63FF` | In-product gift actions (OPEN, Claim) on night-navy surfaces. |

### Accent Colors
Candy spectrum. Each is a card fill, a mascot colour and a gift-box colourway.

| Name | Hex | Usage |
|---|---|---|
| Gift Lavender | `#A98BFF` | Signature gift box body (from D), violet glow source. |
| Starburst Purple | `#C25BF2` | Purple mascot card, purple highlights. |
| Jelly Pink | `#FF2E6C` | Pink mascot card, pink gift box. |
| Splash Cyan | `#2EC8EE` | Cyan mascot card, cyan gift box. |
| Sky Blue | `#4FB6E8` | Left hero card gradient mid-stop. |
| Zest Lime | `#BEE31A` | Lime mascot card, lime gift box. |
| Sunset Orange | `#FF8A3D` | Orange gift box, warm accents. |
| Confetti set | `#E040C8` `#2FD3B5` `#FF9A2E` `#3F8CFF` `#FF4F7B` | Confetti pieces only (magenta, teal, orange, blue, coral). |

**Hero card gradients (from A, with the grain overlay applied on top)**
| Name | Gradient |
|---|---|
| Cyan Wave (left card) | `linear-gradient(160deg, #7FE3F0 0%, #4FB6E8 50%, #3C8DE0 100%)` |
| Ember Glow (centre card) | `linear-gradient(180deg, #FFFFFF 0%, #FFE3D2 22%, #FF8A4C 62%, #FF4F6E 100%)` |
| Violet Dusk (right card) | `linear-gradient(160deg, #4B6BFF 0%, #8B5CF6 45%, #D45BB0 75%, #FF8A5C 100%)` |

**Gift box colourways.** Rule: a box is never the same hue family as the card it sits in.
| Colourway | Body | Lid | Ribbon | Bow | Shade | Default hero card |
|---|---|---|---|---|---|---|
| Lavender | `#A98BFF` | `#B89DFF` | `#E4DBFF` | `#D5C8FF` | `#7C5CE0` | Ember Glow (centre) |
| Jelly Pink | `#FF2E6C` | `#FF4D82` | `#FFD6E3` | `#FF8FB0` | `#C71A52` | Cyan Wave (left) |
| Zest Lime | `#BEE31A` | `#CDF03A` | `#F5FFC9` | `#E8FF73` | `#8FAE0A` | Violet Dusk (right) |
| Splash Cyan | `#2EC8EE` | `#59D6F4` | `#D3F6FF` | `#9BE8FA` | `#1A97BA` | Night Navy stage, white frame |
| Sunset Orange | `#FF8A3D` | `#FFA25F` | `#FFE3CC` | `#FFC399` | `#D9611A` | Night Navy stage, Violet Dusk |

### Interactive
| Name | Hex | Usage |
|---|---|---|
| Open Periwinkle | `#6C63FF` | OPEN / Claim button fill, focus ring base. |
| Periwinkle Hover | `#7F77FF` | Hover on the above. |
| Periwinkle Active | `#5A52E6` | Pressed state. |
| Focus Ring | `rgba(108,99,255,0.45)` | 3px outer ring on every focusable element. |
| Link on White | `#6C63FF` | Text links on the white frame. |
| Link on Dark | `#FFFFFF` | Links on dark, underline on hover. |
| Success | `#BEE31A` | Selected / confirmed states on dark. |
| Error on Dark | `#FF6B8B` | Input errors on dark surfaces. |

### Neutral Scale
| Step | Hex | Usage |
|---|---|---|
| N-950 | `#050505` | Page background. |
| N-900 | `#0E0E10` | Footer, deepest panels. |
| N-850 | `#161618` | Raised dark surface. |
| N-800 | `#232323` | Graphite feature card (from B). |
| N-700 | `#2F2F31` | Input fill on graphite. |
| N-600 | `#4A4A4A` | Presentation backdrop behind the white frame in mockups. |
| N-500 | `#8A8A92` | Muted labels ("Price", "Highest Bid"). |
| N-400 | `#A0A0A8` | Body copy on dark (the small hero paragraph). |
| N-200 | `#E8E8EC` | Hairlines on white. |
| N-0 | `#FFFFFF` | White. |

### Surface & Borders
| Name | Value | Usage |
|---|---|---|
| Night Navy Stage | `linear-gradient(180deg, #13165F 0%, #0A0B2E 45%, #03030C 100%)` | Gift reveal full-screen background (from C). |
| Dusk Panel | `#272B52` | Gift modal surface (from D). |
| Graphite Card | `#232323` | Mascot picker feature card. |
| Frame White | `#FFFFFF` | The mascot section's outer sheet. |
| Hairline on Dark | `rgba(255,255,255,0.10)` | Card and input borders on dark. |
| Hairline on White | `rgba(10,10,10,0.08)` | Dividers on the white frame. |
| Contour Lines | `rgba(255,255,255,0.06)` | Hero background wave lines, fading out towards the bottom. |
| Grain Overlay | 8% opacity noise, `mix-blend-mode: soft-light` | On every gradient card. |

---

## 3. Typography Rules

### Font Family
**Locked pair. No substitutions, no third font, no Inter.**

- **Primary (display and headings): Georama.** Geometric, slightly wide, friendly. It matches the open, round letterforms of the hero headline in A. Weights loaded: 400, 500, 600, 700. Source: Google Fonts.
  `font-family: 'Georama', system-ui, -apple-system, 'Segoe UI', sans-serif;`
- **Secondary (UI and body): Satoshi.** Clean, compact geometric grotesque. It takes the place of every Inter-style UI font in the references (C and D text, B body copy and buttons). Weights loaded: 400, 500, 700 only. Source: Fontshare.
  `font-family: 'Satoshi', system-ui, -apple-system, 'Segoe UI', sans-serif;`

```css
@import url('https://fonts.googleapis.com/css2?family=Georama:wght@400;500;600;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');

:root {
  --font-display: 'Georama', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-ui:      'Satoshi', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

### Hierarchy
| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display 1 | Georama | 80px (mobile 44px) | 500 | 1.05 (84px) | -0.03em | Hero headline, white, centred, 2 lines, Title Case. |
| Display 2 | Georama | 56px (mobile 36px) | 500 | 1.08 (60px) | -0.025em | Section headings, e.g. "Choose your mascot". |
| Heading 3 | Georama | 28px (mobile 24px) | 600 | 1.2 (34px) | -0.01em | Gift modal title ("Special Gift For you" style), reveal text. |
| Heading 4 / Card Title | Georama | 20px | 600 | 1.2 (24px) | -0.005em | Hero card titles, mascot names. |
| Body Large | Satoshi | 18px | 400 | 1.55 (28px) | 0 | Section intros, reveal subtext. |
| Body Regular | Satoshi | 15px | 400 | 1.6 (24px) | 0 | Paragraphs, the small hero side paragraph, mascot captions. |
| Card Meta | Satoshi | 14px | 500 | 1.4 (20px) | 0 | "Highest Bid"-style subtitle and muted label lines. |
| Price / Numeral | Georama | 16px | 700 | 1.2 (20px) | 0 | Right-aligned values ("0.024 ETH" style), countdowns, counts. |
| Link / Nav | Satoshi | 14px | 500 | 1.4 (20px) | 0.01em | Nav links; underline on hover. |
| Button | Satoshi | 15px | 700 | 1 (20px) | 0.01em | All buttons. The OPEN gift action uses uppercase and 0.08em. |
| Input | Satoshi | 16px | 500 | 1.5 (24px) | 0 | 16px minimum so iOS never zooms on focus. |
| Caption | Satoshi | 12px | 500 | 1.4 (16px) | 0.02em | Mascot trait lines, helper text. |
| Overline / Badge | Satoshi | 11px | 700 | 1 | 0.22em | Uppercase; the rotating circular text badge. |

### Principles
- Georama carries identity: headlines, card titles, mascot names, prices, countdowns. Satoshi carries function: nav, buttons, inputs, paragraphs, captions.
- The hero headline stays at weight 500, never bold. The lightness is what makes it feel airy against the heavy colour of the cards.
- Numerals that change (price, timer, count) are always Georama 700 so they read as "objects", not body text.
- Weight steps are 400 / 500 / 700 for Satoshi and 500 / 600 / 700 for Georama. Do not introduce other weights.
- Tight negative tracking on large Georama (-0.025em to -0.03em), neutral on small text. Never track out lowercase body copy.
- Text on candy cards follows the card: white on purple and pink, near-black (`#0A0A0A`) on cyan, lime and orange.
- Headlines are Title Case. Body and button labels are sentence case, except the OPEN action which is uppercase.

---

## 4. Component Stylings

### Buttons

**Primary Button (Ember CTA pill, one per view)**
- Background: `linear-gradient(90deg, #FF5A1F 0%, #FF9A4D 100%)`
- Text Color: `#0A0A0A`
- Padding: 0 28px
- Border Radius: 999px
- Border: none
- Font: Satoshi 700, 15px, line height 20px
- Height: 48px (nav version 44px)
- Hover State: `filter: brightness(1.06)`, `translateY(-1px)`, `box-shadow: 0 10px 28px -8px rgba(255,106,44,0.55)`
- Active State: `scale(0.97)`, no shadow

**Secondary / Ghost Button (White pill on colour, outline on dark)**
- Background: `#FFFFFF` on candy cards (the "Choose" button in B). Transparent on dark.
- Text Color: `#0A0A0A` on white. `#FFFFFF` on dark.
- Padding: 0 24px
- Border Radius: 999px
- Border: none on white. `1.5px solid rgba(255,255,255,0.24)` on dark.
- Font: Satoshi 700, 14px, line height 20px
- Height: 40px (card button) or 48px (standalone)
- Hover State: white button lifts `translateY(-2px)` with `0 8px 16px -6px rgba(0,0,0,0.35)`. Outline button border goes to `rgba(255,255,255,0.6)`.
- Active State: `scale(0.96)`
- Selected State (mascot "Choose" → "Chosen"): background `#0A0A0A`, text `#FFFFFF`, check icon 14px at left.

**Tertiary Button (Gift Action, "OPEN")**
- Background: `#6C63FF`
- Text Color: `#FFFFFF`
- Padding: 0 32px, full width inside the gift modal
- Border Radius: 999px
- Border: none
- Font: Satoshi 700, 15px, uppercase, 0.08em
- Height: 56px
- Hover State: background `#7F77FF`, `box-shadow: 0 12px 32px -10px rgba(108,99,255,0.7)`
- Active State: background `#5A52E6`, `scale(0.98)`. Triggers the opening sequence.

### Cards & Containers

**Standard Card: Hero Gift Card (from A, layout kept exactly)**
- Background: one of the three hero gradients (Cyan Wave, Ember Glow, Violet Dusk) plus grain overlay
- Text Color: `#0A0A0A` on all three (Satoshi/Georama, as in A)
- Padding: 28px top and sides, 0 at the bottom (the gift box bleeds to the card's lower edge)
- Border Radius: 40px
- Border: none
- Width: 400px side cards, 440px centre card. Height 520px side, 560px centre.
- Box Shadow: coloured glow, `0 40px 80px -30px <card mid-colour at 50%>`; inner top highlight `inset 0 1px 0 rgba(255,255,255,0.35)`
- Transform: left `rotate(-14deg)`, right `rotate(12deg)`, centre `translateY(-48px)`. Stack order left → centre → right (z 1 / 2 / 3), overlapping by about 80px.
- Slots (same positions as A): top-left = **Title** (Georama 600 20px) over **Subtitle** (Satoshi 500 14px) over **Label** (Satoshi 500 14px, N-500 or 60% black). Top-right = **Avatar cluster**. Right of the label row = **Value** (Georama 700 16px, right-aligned). Lower 60% = **gift box**, slightly cropped by the card's bottom edge.
- Placeholder copy: Title "Starter Box", Subtitle "Opens on shake or tap", Label "Price", Value "0.024 ETH".
- Gift box inside: one colourway per card (see the colourway table). Box is about 70% of the card width, tilted 6–10° opposite to the card's tilt. A small mascot can perch on the lid of the centre card's box, echoing the little yellow character in A.
- Avatar cluster: 3–4 circles, 36px, overlap -12px, `2px solid #FFFFFF` ring. Each avatar is a mascot head on its card-colour disc.
- Hover State: card straightens 3° towards upright, `translateY(-12px)`, box wobbles ±4° once (400ms).
- Active State: `scale(0.98)`

**Feature Card (Wide): Mascot Preview Card (from B)**
- Background: `#232323`
- Text Color: `#FFFFFF` (body copy `rgba(255,255,255,0.8)`)
- Padding: 32px
- Border Radius: 24px
- Border: none
- Width: about 45% of the frame's inner width, full height of the 2×2 grid beside it
- Contents (centred stack): Display-2-small heading (Georama 500, 40px) → large mascot preview, 200px → Body Regular line → display-name input (see Inputs) → white pill CTA, "Continue", 52px tall.
- The preview shows whichever mascot is currently selected. Switching mascots cross-fades with a 6° scale-bounce (240ms).
- Hover State: none on the card. Mascot idles with a 3s ±6px float.
- Active State: n/a

**Mascot Card (Highlighted candy card, from B)**
- Background: flat candy fill (Starburst Purple `#C25BF2`, Jelly Pink `#FF2E6C`, Splash Cyan `#2EC8EE`, Zest Lime `#BEE31A`) with the grain overlay at 5%
- Text Color: white on purple and pink, `#0A0A0A` on cyan and lime
- Padding: 20px
- Border Radius: 28px
- Border: none (selected: `3px solid #FFFFFF` with a 6px outer glow of the card colour)
- Layout: name top-left (Georama 600, 20px). Info icon top-right (18px, 1.5px outline circle with "!"). Mascot centred, about 55% of card height. Trait caption bottom-left (Satoshi 500, 12px, two lines, e.g. "A loyal / friend"). "Choose" pill bottom-right (100 × 40).
- Size: about 255 × 297px in a 2×2 grid with 16px gaps
- Mascot style: soft inflated clay, top-left key light, one glossy rim highlight, black oval eyes with two white specular dots, blush ovals (body colour at 80% lightness, 60% opacity), tiny mouth (short dark stroke, or a small open "o").
- Roster: four shape archetypes as in B (star, blob, cloud, cone) are placeholders. Give them your own names. Extend to 6–8 for avatar variety, one candy colour each. Reuse colours only after all eight are used.
- Hover State: `translateY(-4px)`, mascot tilts 6°, "Choose" button grows to 104 × 42
- Active State: `scale(0.98)`. On select, the "Choose" button becomes "Chosen ✓" (see Secondary Button).

**Highlighted Container: Gift Modal and Reveal Stage (from D and C)**
- Background: Dusk Panel `#272B52` for the modal. Night Navy Stage gradient for the full-screen reveal.
- Text Color: `#FFFFFF` (subtext `rgba(255,255,255,0.7)`)
- Padding: 32px, 24px on mobile
- Border Radius: 24px (modal). Full-bleed on the reveal screen.
- Border: `1px solid rgba(255,255,255,0.08)`
- Width: 360px modal on desktop, 100% minus 32px on mobile
- Box Shadow: `0 40px 100px -20px rgba(0,0,0,0.6)`
- Layout: centred gift box (160px) with confetti scattered around it, Heading 3, optional Body Regular line, then the full-width OPEN button.
- Box idle: float ±6px over 3s, soft violet halo `radial-gradient(circle, rgba(122,92,255,0.45), transparent 65%)` behind it.
- **Gift interaction (shake or tap, both always available):**
  | State | Trigger | Animation |
  |---|---|---|
  | Idle | Default | Float ±6px, 3s ease-in-out loop. Halo breathes 0.8 ↔ 1. |
  | Hint | After 4s idle | Small "Shake or tap to open" caption fades in (Satoshi 500, 12px, 60% white) with a 16px phone icon. |
  | Shaking | Device shake, or press-and-hold | Box rotates ±8° and shifts ±6px, intensity scaled to motion. Sparkles emit. Light haptic if available. |
  | Opening | Shake threshold reached, tap on box, or tap on OPEN | 0–120ms squash 0.94. 120–420ms lid lifts -44px and rotates 22°, bow unties. 200ms white burst (halo to 1.6×). 60 confetti pieces launch (400–900ms, gravity, spin). |
  | Revealed | Opening ends | Navy stage fades in. Prize medallion scales 0.6 → 1 with an overshoot (faceted glass treatment from C). Reveal text and a white pill "Keep going" fade up. |
  | Reduced motion | `prefers-reduced-motion` | No wobble or confetti. Lid cross-fades and the prize fades in over 300ms. |
- Shake detection: use `devicemotion`; count two spikes above about 15 m/s² within 800ms. iOS Safari needs `DeviceMotionEvent.requestPermission()` called from a user tap, so the first tap on OPEN should also request motion permission for next time. Desktop and denied-permission users just tap. Haptics via `navigator.vibrate([20, 40, 20])` where supported (Android only).
- Prize medallion (reveal): octagonal faceted glass, core `#4B3FD8`, edges iridescent teal-to-violet (`#35E0C0` → `#8A5CF6`), white four-point star at the centre, outer glow `0 0 120px 40px rgba(122,92,255,0.45)`, 3–6 drifting violet specks.

### Inputs & Forms

**Text Input (display name, on the graphite feature card)**
- Background: `#2F2F31`
- Text Color: `#FFFFFF`
- Padding: 0 20px
- Border Radius: 999px (pill, matches buttons)
- Border: `1.5px solid rgba(255,255,255,0.14)`
- Font: Satoshi 500, 16px
- Height: 52px
- Placeholder Color: `rgba(255,255,255,0.45)`
- Focus State: border `#6C63FF`, outer ring `0 0 0 3px rgba(108,99,255,0.45)`
- Disabled State: opacity 0.4, background transparent, cursor not-allowed
- Error State: border `#FF6B8B`, helper text `#FF6B8B`
- On the white frame: background `#F4F4F7`, text `#0A0A0A`, border `1.5px solid rgba(10,10,10,0.08)`, placeholder `rgba(10,10,10,0.4)`.

**Input Label**
- Satoshi 700, 13px, `rgba(255,255,255,0.8)` on dark or `#0A0A0A` on white; 8px below to the input; sentence case.

**Input Helper Text**
- Satoshi 500, 12px, `#A0A0A8` on dark (`#6B6B75` on white); sits 8px below the input; success uses `#BEE31A`, error `#FF6B8B`.

### Navigation

**Primary Navigation**
- Background: transparent over Void Black (becomes `rgba(5,5,5,0.72)` with `backdrop-filter: blur(16px)` once scrolled)
- Text Color: `#FFFFFF`
- Height: 72px, padding 0 40px (mobile 64px, 0 20px)
- Layout (from A): wordmark left (Georama 700, 18px) → links centred (gap 32px) → Ember pill CTA right.
- Inside the white frame section (from B): the nav row becomes `#0A0A0A` text on white, with a 28px three-line hamburger on the right (2px lines, 6px gap), logo left. This variant appears only within the frame.
- Mobile: links collapse into the hamburger, CTA moves into the menu sheet.

**Navigation Link**
- Satoshi 500, 14px, `#FFFFFF` at 80% opacity; hover to 100% with a 1.5px underline 6px below the text (200ms); active page has a 6px white dot centred under the label.

---

## 5. Layout Principles

### Spacing System
**Base unit:** 8px, with a 4px half-step for tight pairings.

| Token | Value | Use |
|---|---|---|
| space-1 | 4px | Icon gaps, avatar ring offsets |
| space-2 | 8px | Label to input, button icon gap |
| space-3 | 12px | Avatar overlap, caption stacks |
| space-4 | 16px | Mascot grid gap, card inner gaps |
| space-5 | 24px | Card padding (small), frame padding |
| space-6 | 32px | Card padding (large), nav side padding |
| space-7 | 48px | Between headline and card fan |
| space-8 | 64px | Section inner vertical rhythm |
| space-9 | 96px | Section-to-section gap |
| space-10 | 128px | Hero top padding, major breaks |

### Grid & Container
- **Max width:** 1360px content, centred. Side padding 40px desktop, 24px tablet, 16px mobile.
- **Hero (A layout, unchanged):** nav → rotating circular text badge on the left (96px circle, text "Shake · Tap · Open ·" at 11px uppercase, 20s linear rotation) beside a centred two-line Display 1 headline → fan of three hero gift cards centred below, overlapping, bleeding off the bottom of the fold → small paragraph on the far right (Body Regular, N-400, max 200px, 5 lines).
  ```
  ┌────────────────────────────────────────────────────────────┐
  │ Logo        Link  Link  Link  Link  Link        (Ember CTA) │
  │                                                            │
  │  ◌ badge          Open Something                           │
  │ (rotates)         Wonderful Today                          │
  │                                                            │
  │      ╱ left ╲   ┌── centre ──┐   ╱ right ╲     small text  │
  │     │  -14°  │  │  upright   │  │  +12°   │    paragraph   │
  │     ▼▼ cards bleed past the fold ▼▼                        │
  └────────────────────────────────────────────────────────────┘
  ```
- **Mascot picker (B layout):** one white frame (`#FFFFFF`, radius 40px, padding 24px, soft shadow) containing its own nav row, then a two-column row: the graphite feature card on the left (about 45%) and a 2×2 mascot card grid on the right (about 55%, 16px gaps). Heights match.
- **Gift modal / reveal:** a centred single column, max 360px, on top of a dimmed page (modal) or replacing the page (reveal).
- **Page rhythm:** dark hero → dark content → white frame (mascot picker) → dark content → footer. One white section only.
- **Background linework:** SVG wave contours at 6% white across the top 60% of the hero, fading to transparent.

### Whitespace Philosophy
Generous and theatrical at the top, tight inside the cards. The hero has about 128px above the headline and 48px between headline and card fan, so the cards feel presented rather than listed. Inside cards, spacing is snug (16–28px) and the 3D object is allowed to crowd or bleed past the card edge, which makes it feel like it is about to jump out. Dense colour on a sparse black field is the whole effect, so never fill the black with extra elements.

### Border Radius Scale
| Step | Value | Use |
|---|---|---|
| Sharp | 0px | Never used on visible containers. |
| xs | 8px | Small chips, tooltips. |
| sm | 12px | Toasts, small image thumbnails. |
| md | 16px | Inner panels inside the modal. |
| lg | 24px | Graphite feature card, gift modal. |
| xl | 28px | Mascot cards. |
| 2xl | 40px | Hero gift cards, white frame. |
| Pill | 999px | Every button, input, badge and tag. Avatars are circles. |

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Page background, nav, headline, paragraphs. |
| Subtle | `1px solid rgba(255,255,255,0.10)` or `inset 0 1px 0 rgba(255,255,255,0.06)` | Graphite card, inputs on dark. |
| Base | Gradient fill + grain + `inset 0 1px 0 rgba(255,255,255,0.35)` | Hero gift cards, mascot cards. |
| Medium | Coloured glow `0 40px 80px -30px <card colour at 50%>` | Hero cards on black (black shadows would vanish). |
| High | `0 30px 60px rgba(0,0,0,0.35)` | White frame lifted off its backdrop; gift modal `0 40px 100px -20px rgba(0,0,0,0.6)`. |
| Glow | `0 0 120px 40px rgba(122,92,255,0.45)` plus sparkles | Gift box halo, prize medallion on the reveal stage. |
| Object | Soft contact shadow `0 24px 24px -16px rgba(0,0,0,0.35)` under 3D objects, with a bounce-light tint of the opposite hue on the lower-right | Gift boxes and mascots. |

Elevation on dark comes from colour and glow, not from black drop shadows. Elevation on white comes from soft grey shadow.

---

## 7. Do's and Don'ts

### Do
- Use Georama for display, headings, card titles and numerals, and Satoshi for everything else. Nothing else gets loaded.
- Keep the hero layout exactly as in A: centred two-line headline, rotating badge left, three fanned cards (-14° / upright raised / +12°), paragraph right, cards bleeding past the fold.
- Give every hero card its own gradient and its own gift box colourway, and make sure the box contrasts with the card (lavender on orange, pink on cyan, lime on violet).
- Render gift boxes and mascots in the same soft-clay 3D style: top-left key light, rim highlight, soft contact shadow.
- Keep the white frame section to one per page and give it the graphite feature card plus the 2×2 mascot grid.
- Always offer a tap path to open a gift. Shake is an enhancement only.
- Use full pill radius for every button and input, and 28–40px radii for cards.
- Put dark text on cyan, lime and orange surfaces and white text on purple and pink ones.

### Don't
- Don't use Inter, or any font other than Georama and Satoshi, including in fallbacks, code-style numerals, or third-party widgets you can restyle.
- Don't put flat fills on the hero cards. They need the gradient and the grain.
- Don't use black drop shadows to lift cards on the dark page. Use coloured glow.
- Don't match a gift box to its card's colour family, and don't mix two candy colours inside one mascot card.
- Don't add a second white section, or lighten the page background. The dark canvas is the system.
- Don't use sharp corners, thin outlined 2D icons in place of 3D objects, or flat vector mascots.
- Don't bold the hero headline or set it in all caps.
- Don't require shake. Don't run confetti or wobble under `prefers-reduced-motion`.

---

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | Single column. Display 1 at 44px. Card fan becomes a swipeable stack (see below). Hamburger nav. Mascot grid under the feature card. |
| Tablet | 640–1023px | Display 1 at 60px. Fan keeps three cards at 70% scale. Mascot section stays stacked, grid 2×2 full width. |
| Desktop | 1024–1439px | Full A layout. Mascot section side by side (45 / 55). |
| Wide | ≥ 1440px | Content capped at 1360px, fan and headline scale to Display 1 at 80px; extra space goes to the dark margins, not to wider cards. |

### Touch Targets
- Minimum 44 × 44px. Recommended 48px. Primary and OPEN buttons 48–56px.
- 8px minimum between adjacent targets. The mascot "Choose" pill is 40px tall inside a card that is itself tappable, so the whole card also selects.
- The gift box itself is a tap target of at least 160 × 160px.

### Collapsing Strategy
- **Hero fan:** at tablet the three cards scale to 70%. On mobile the centre card is full-focus at about 78% viewport width, and the left and right cards peek behind it at 88% scale (±10° tilt, 12% visible). Swipe horizontally to bring a side card forward (scroll-snap, 280ms spring). The rotating badge shrinks to 72px and moves above the headline.
- **Headline:** keeps two lines on mobile by dropping to 44px with the same -0.03em tracking.
- **Nav:** links collapse into a three-line hamburger (white on dark). The Ember CTA moves to the bottom of the menu sheet at full width.
- **Mascot picker:** the white frame goes edge-to-edge minus 16px with 28px radius. The feature card stacks above the grid. The 2×2 grid stays 2 columns on mobile with 12px gaps, cards about 164px wide, captions drop to one line, and the "Choose" pill becomes full-width.
- **Gift modal:** becomes a bottom sheet (radius 24px top corners) on mobile, with the OPEN button pinned at the bottom with safe-area padding.
- **Spacing:** space-9 and space-10 collapse to 64px and 80px respectively. Card padding drops from 28px to 20px.

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Page background: `#050505`
- Primary CTA: Ember gradient `#FF5A1F → #FF9A4D`, text `#0A0A0A`
- Gift action (OPEN): `#6C63FF`, hover `#7F77FF`, active `#5A52E6`
- Hero cards: Cyan Wave (`#7FE3F0 → #3C8DE0`), Ember Glow (`#FFFFFF → #FF4F6E`), Violet Dusk (`#4B6BFF → #FF8A5C`)
- Mascot cards: purple `#C25BF2`, pink `#FF2E6C`, cyan `#2EC8EE`, lime `#BEE31A`
- Gift box signature: lavender `#A98BFF` with ribbon `#E4DBFF`
- Graphite feature card: `#232323`. Dusk modal: `#272B52`. Reveal stage: `#13165F → #03030C`
- Body text on dark: `#A0A0A8`. Muted labels: `#8A8A92`
- Fonts: Georama (display) + Satoshi (UI). Nothing else.

### Iteration Guide
1. Load only Georama (400/500/600/700) and Satoshi (400/500/700). Never reference Inter, in CSS, fallbacks or components.
2. Page background is always `#050505`. Add the 6% white wave-contour SVG behind the hero only.
3. Hero headline: Georama 500, 80px / 1.05, -0.03em, white, centred, two lines, Title Case.
4. Build the hero fan with exactly three cards: left `rotate(-14deg)`, centre upright with `translateY(-48px)`, right `rotate(12deg)`, z-index 1/2/3, 80px overlap, bleeding off the fold.
5. Every hero card is a gradient from the Cyan Wave / Ember Glow / Violet Dusk list, with radius 40px and an 8% soft-light grain overlay. Never use a flat fill.
6. Put one gift box colourway in each card, using the contrast pairing from the table (pink on cyan, lavender on orange, lime on violet), roughly 70% of card width and cropped by the card's bottom edge.
7. The single marketing CTA per view is the Ember pill: 48px tall, radius 999px, text `#0A0A0A`, Satoshi 700 15px.
8. The mascot section is one white frame (radius 40px, padding 24px) with a `#232323` feature card (radius 24px) on the left and a 2×2 grid of 28px-radius candy cards on the right, 16px gaps. Each card has a name top-left, info icon top-right, mascot centred, caption bottom-left and a white "Choose" pill bottom-right.
9. The display-name field lives in the graphite feature card: 52px tall, pill radius, `#2F2F31` fill, 16px Satoshi, focus ring `rgba(108,99,255,0.45)`.
10. Mascots and gift boxes are soft-clay 3D with a top-left key light and a soft contact shadow. Mascot faces are exactly: glossy black oval eyes with two white specular dots, tone-on-tone blush ovals, tiny mouth.
11. The gift modal is `#272B52`, radius 24px, with a 160px box, Heading 3 in Georama 600 28px and a full-width 56px OPEN pill in `#6C63FF`. Opening works by tap on the box, tap on OPEN, or a device shake (two spikes above about 15 m/s² within 800ms), with permission requested from the first tap on iOS.
12. Reveal screens use the Night Navy gradient, a glass prize medallion with violet glow, and Georama 700 for the prize numeral. Under `prefers-reduced-motion`, replace wobble and confetti with a 300ms cross-fade.
