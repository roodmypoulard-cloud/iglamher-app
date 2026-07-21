# Design System

## Color tokens

```css
:root {
  --background: #0B0909;
  --background-elevated: #121010;
  --surface: #181414;
  --surface-hover: #211B1A;
  --surface-muted: #2A2220;
  --border: #3A2D29;
  --border-subtle: #251E1C;

  --text-primary: #FFF8F4;
  --text-secondary: #CDBEB7;
  --text-muted: #998A83;
  --text-inverse: #170F0D;

  --rose-gold: #D7A08F;
  --rose-gold-light: #F0C0B4;
  --rose-gold-dark: #A96E5E;
  --blush: #E7A9AA;
  --gold: #C99A4B;

  --success: #68B487;
  --warning: #D9A441;
  --danger: #D76E73;
  --info: #729CC8;
}
```

Metallic treatments should be limited to logos and premium display moments. Functional text and controls must use solid accessible colors.

## Typography

Recommended open-source implementation:

- Display and headings: `Cormorant Garamond`
- Body and UI: `Inter`
- Script accent: `Italiana` or a licensed custom script only for the logo

Typography scale:

- Display XL: 64/68, 500
- Display L: 48/52, 500
- H1: 40/44, 500
- H2: 32/38, 500
- H3: 24/30, 600
- H4: 20/26, 600
- Body L: 18/28, 400
- Body: 16/24, 400
- Body S: 14/20, 400
- Label: 12/16, 600, 0.08em tracking
- Caption: 12/16, 400

## Spacing

Use a 4-pixel base:
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

## Radius

- Small control: 8px
- Input/button: 12px
- Card: 16px
- Large card/modal: 24px
- Pill: 999px

## Shadows

Use shadows sparingly on the dark UI.

```css
--shadow-card: 0 16px 40px rgba(0,0,0,.30);
--shadow-floating: 0 24px 70px rgba(0,0,0,.48);
--focus-ring: 0 0 0 3px rgba(231,169,170,.30);
```

## Motion

- Micro-interaction: 150ms
- Standard transition: 220ms
- Page/overlay: 300ms
- Easing: cubic-bezier(.2,.8,.2,1)
- Respect `prefers-reduced-motion`

## Breakpoints

- Mobile: 0–639
- Large mobile/small tablet: 640–767
- Tablet: 768–1023
- Desktop: 1024–1439
- Wide desktop: 1440+
