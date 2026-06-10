# Customer Portal — Design System

> Single source of truth for visual style, component usage, and accessibility rules in this app. Colors are governed elsewhere (see `globals.css` `:root` / `.dark` blocks) and are intentionally **out of scope** for this document.

---

## 1. Tokens

All tokens live in `src/app/globals.css` inside the `@theme inline` block, which exposes them to Tailwind v4 as utilities. **Use tokens via Tailwind classes or `var(--token)`. Never hardcode pixel values, font sizes, durations, or shadows in component code.**

### 1.1 Typography

| Token            | Value     | Use                                     |
| ---------------- | --------- | --------------------------------------- |
| `--text-2xs`     | 11px      | Micro labels, badge text                |
| `--text-xs`      | 12px      | Captions, helper text, meta             |
| `--text-sm`      | 13px      | Secondary body                          |
| `--text-base`    | 14px      | **Default body** — set on `<body>`      |
| `--text-md`      | 15px      | Emphasized body, table headers          |
| `--text-lg`      | 17px      | Card titles, h4–h5                      |
| `--text-xl`      | 20px      | Section headings, h3                    |
| `--text-2xl`     | 24px      | Page headings, h2                       |
| `--text-3xl`     | 30px      | Hero, h1                                |
| `--text-4xl`     | 36px      | Marketing-grade display                 |

Weight: `regular 400`, `medium 500`, `semibold 600`, `bold 700`.
Line-height: `tight 1.2`, `snug 1.35`, `normal 1.5`, `relaxed 1.65`.
Headings (`h1`–`h6`) ship with sensible defaults — only override when the visual hierarchy demands it.

**Rule:** never combine more than 3 type sizes on a single screen.

### 1.2 Spacing

4-px base scale, exposed as `--space-0` … `--space-24`. Match component padding to the size of its content (e.g. `--space-2` inside an `sm` button, `--space-4` inside a card). For layout gutters between unrelated blocks, prefer `--space-6` or `--space-8`.

### 1.3 Radii

`--radius` (0.75rem) is the anchor. Derived: `sm 0.6×`, `md 0.8×`, `lg 1×`, `xl 1.4×`, up to `4xl 2.6×`. Use `md` for inputs/buttons, `lg` for cards, `xl`+ for modals and marketing surfaces.

### 1.4 Elevation

`--shadow-xs … --shadow-xl`. Map to depth, not decoration: `xs` for hover lift on flat surfaces, `sm` for resting cards, `md` for popovers, `lg` for dialogs, `xl` for command-palette / toasts.

### 1.5 Motion

| Token              | Value  | Use                              |
| ------------------ | ------ | -------------------------------- |
| `--duration-instant` | 80ms  | Hover/press feedback              |
| `--duration-fast`    | 140ms | Tooltips, small reveals           |
| `--duration-normal`  | 220ms | Dialogs, popovers, route changes  |
| `--duration-slow`    | 320ms | Page-level transitions            |

Easings: `--ease-out-quart` (default), `--ease-in-out` (symmetric reveals), `--ease-spring` (playful affordances — use sparingly).

`prefers-reduced-motion: reduce` is honored globally in `globals.css` — all transitions collapse to 0.001ms. **Do not** add motion that conveys meaning without a non-motion fallback (WCAG 2.3.3).

### 1.6 Layout

- `--tap-target-min: 44px` — minimum hit area for icon-only controls (WCAG 2.5.5).
- `--container-max: 1280px` — page-level max width.
- `--container-prose: 65ch` — readable text-column width.

### 1.7 Z-index

Use the named scale (`--z-base` … `--z-tooltip`). Never invent z-index values in component code.

---

## 2. Responsive

Tailwind defaults: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Design mobile-first; promote layouts at `md` (tablet) and `lg` (desktop).

**Rules**

- Form inputs use `text-base md:text-sm` — iOS Safari zooms when an input is < 16px on focus.
- Tap targets on touch viewports (`max-width: 768px`) should hit `--tap-target-min`.
- No horizontal scroll on viewports ≥ 320px. Test in Safari iOS 15+ — use `overflow-x-hidden` only as last resort.

---

## 3. Components

All primitives live in `src/components/ui/`. They are built on `@base-ui/react` and `@radix-ui/*`, which give us correct ARIA semantics out of the box. Prefer composition over forking; if a new variant is needed, add it to the existing `cva` config rather than creating a parallel component.

### 3.1 Button (`button.tsx`)

- Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`.
- Sizes: `xs (24)`, `sm (28)`, `default (32)`, `lg (36)`, plus `icon`, `icon-xs`, `icon-sm`, `icon-lg`.
- Icon-only buttons **must** include a `<span className="sr-only">` label or `aria-label`.
- Use `asChild` to render the styles on a `<Link>` — never wrap a Button in an anchor.
- For destructive actions, pair with a confirmation Dialog. Never destructive-as-primary in a sticky bar.

### 3.2 Input / Textarea

- Always pair with a `<Label htmlFor>` or wrap the input inside the label. A floating placeholder is **not** a label.
- Use the `required` prop on `<Label>` for the visual marker, and `aria-required="true"` on the input itself.
- Error state: set `aria-invalid="true"` and link the message with `aria-describedby={errorId}`. The component reacts to `aria-invalid` automatically.
- For inline helper text, render below the input with `text-xs text-muted-foreground` and link via `aria-describedby`.

### 3.3 Dialog

- Always include a `<DialogTitle>`. If the title is visually hidden, wrap it in `sr-only` — never omit it (Radix will warn, and screen-reader users lose context).
- Include a `<DialogDescription>` whenever the dialog contains form fields or destructive consequences.
- Trap focus: handled by Base UI. Do not add your own focus-management.
- For destructive confirmations, the destructive action goes on the **right** and a cancel/close goes on the left.

### 3.4 Skeleton

- Now ships with `role="status"`, `aria-busy="true"`, and an sr-only "Loading…" string. Do not duplicate that label on the parent.
- Use skeletons only when content shape is predictable. For uncertain or async-collection lists, use a spinner with text instead.

### 3.5 Table

- Always render a `<caption className="sr-only">` describing the table.
- Use semantic `<th scope="col">` / `<th scope="row">`.
- Sortable columns: button inside `<th>`, with `aria-sort="ascending|descending|none"` on the `<th>`.

### 3.6 Toast / Notifications (`sonner`)

- Use toasts for **transient** feedback only — never for content the user must read or act on.
- Duration ≥ 5s for messages with actions, ≥ 3s for confirmations.
- Errors that block progress must use a Dialog or inline alert, not a toast.

---

## 4. Accessibility (WCAG 2.1 AA)

The app targets WCAG 2.1 AA. This section lists the rules we enforce; CI does not yet block on a11y, so reviewers must verify.

### 4.1 Keyboard

- Every interactive element reachable by `Tab` in DOM order.
- `Enter` activates buttons and links; `Space` activates buttons and checkboxes; `Esc` closes overlays.
- Visible focus on every focusable element — handled by the global `:focus-visible` rule. Do **not** add `outline: none` without an equivalent replacement.
- Provide a skip-link at the top of the root layout:
  ```tsx
  <a href="#main" className="skip-link">Skip to main content</a>
  ```

### 4.2 Screen reader

- All images: meaningful `alt` text, or `alt=""` if purely decorative.
- All icon-only controls: `aria-label` or sr-only text.
- Live regions: status updates announced via `aria-live="polite"` (use the Skeleton pattern as a model).
- Form errors: linked via `aria-describedby`, announced on submit via `aria-live="assertive"` for the summary.

### 4.3 Contrast

Color tokens are out of scope here, but every text/icon contrast ratio must hit 4.5:1 for body and 3:1 for large text (≥18px or ≥14px bold). Use the Chrome DevTools "Contrast" indicator on every new screen.

### 4.4 Motion & timing

- Respect `prefers-reduced-motion: reduce` (global default).
- Any auto-dismissing UI must be user-pausable or last ≥ 20s.
- Do **not** use motion or color **alone** to convey state — always pair with an icon or text.

### 4.5 Forms

- Every input has a programmatic label.
- Group related radios/checkboxes inside `<fieldset>` with `<legend>`.
- Errors appear next to the offending field, not just in a summary.
- Use `autocomplete` attributes for known fields (name, email, tel, address-line1, etc.).

---

## 5. Do / Don't

| ✅ Do                                                       | ❌ Don't                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| Use tokens (`text-sm`, `--space-4`) for sizes and spacing  | Hardcode `13px` or `0.81rem` in components                    |
| Use existing `ui/` primitives or add variants to them      | Fork a primitive into a parallel file                         |
| Add `sr-only` text to every icon-only button               | Rely on tooltip-only labels for icon controls                 |
| Compose layouts mobile-first, promote at `md`/`lg`         | Design desktop-first and "shrink" for mobile                  |
| Confirm destructive actions in a Dialog                    | Show destructive actions in toasts                            |
| Match motion duration to surface size (`fast` < `slow`)    | Use 500ms+ animations on hover states                         |

---

## 6. Known scope limits

This document covers the foundation only. **Not** covered:

- Color palette (governed by `:root` / `.dark` in `globals.css`)
- Per-route layout patterns (see route folders under `src/app/*`)
- Marketing pages, email templates, transactional surfaces
- Real-user usability validation (requires moderated testing)
- Cross-browser visual QA (requires physical Safari/Firefox/Edge passes)

When adding a new pattern that doesn't fit any existing primitive, propose it in PR before forking.
