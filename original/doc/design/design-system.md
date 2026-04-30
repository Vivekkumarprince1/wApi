# Design System: wApi Premium Emerald

## 1. Visual Theme & Atmosphere
The core aesthetic is "Professional, Efficient, and Premium." It uses a clean, white-space heavy layout with vibrant emerald accents, drawing inspiration from WhatsApp's native interface and high-end CRM platforms like Interakt. The atmosphere is airy and precise, utilizing subtle glassmorphism for elevation and smooth, purposeful animations for state transitions.

## 2. Color Palette & Roles

### Primary & Branding
* **WhatsApp Emerald (#25D366)**: The primary brand color. Used for key action buttons, active sidebar states, and brand identifiers.
* **Deep Teak-Green (#075E54)**: A darker, authoritative green for headers or high-contrast elements.
* **Vibrant Mint (#DCF8C6)**: A light, soft green background for secondary indicators or success messages.

### Neutral & Foundation
* **Glacier White (#FFFFFF)**: The main background for cards and views.
* **Ghost Gray (#F0F2F5)**: Background for secondary surfaces (sidebars, secondary panels).
* **Obsidian Black (#111B21)**: Primary text color for maximum readability.
* **Steel Blue-Gray (#54656F)**: Secondary text and icons.

### System Actions
* **Safety Orange (#FF8C00)**: Warning and pending status.
* **Alizarin Crimson (#EA0038)**: Error, destructive actions, and alerts.
* **Azure Blue (#34B7F1)**: Links and informative highlights.

## 3. Typography Rules
* **Font Family**: Inter (System Sans-Serif stack). Clean, readable, and professional.
* **Headers**: Semi-bold to bold weight with tight letter-spacing for a modern look.
* **Body**: Regular weight, optimized for long-form internal notes and message readability.

## 4. Component Stylings
* **Buttons**: Generously rounded (rounded-lg) with smooth transitions. Primary button uses Emerald background with white text.
* **Cards/Containers**: Subtle rounding (rounded-xl) with very soft diffused shadows (whisper-shadow) and occasional glassmorphic backgrounds (bg-white/80 backdrop-blur-md).
* **Inputs/Forms**: Sharp, clean borders with a vibrant primary focus ring.
* **Sidebar**: Fixed on desktop, collapsible on mobile. Uses glassmorphism for the background to feel integrated with the content.

## 5. Layout Principles
* **Whitespace**: Generous padding (p-6 to p-8) between sections to reduce cognitive load.
* **Grid**: Flexible container-based layout with standard 12-column grid support where needed.
* **Glassmorphism**: Applied to headers, sidebars, and floating panels to signify hierarchy and depth.
