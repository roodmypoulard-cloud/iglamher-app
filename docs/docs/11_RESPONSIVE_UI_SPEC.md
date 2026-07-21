# Responsive UI Specification

## Mobile-first baseline

Design at 390px wide first. Primary controls should sit within easy thumb reach.

- Page gutter: 16px
- Header height: 64px
- Bottom navigation: 72–80px plus safe area
- Cards: full width
- Search filters: bottom sheet
- Booking summary: sticky bottom CTA
- Modals: full-screen sheets for complex flows

## Tablet

- Gutter: 24px
- Two-column professional grid
- Booking may use content plus sticky summary
- Professional dashboard can use collapsible sidebar

## Desktop

- Max content width: 1280px
- Gutter: 32px
- Search results: filters sidebar plus grid
- Profile: main content plus sticky booking panel
- Customer account: sidebar plus content
- Professional/admin: persistent sidebar

## Images

- Use Next Image
- Provide responsive sizes
- Maintain intentional crop with `object-fit: cover`
- Lazy-load below fold
- Preserve skin-tone quality and avoid aggressive compression

## Accessibility

- 4.5:1 contrast for normal functional text
- Focus indicators visible on dark surfaces
- Dialog focus trap
- Error text not communicated by color alone
- Form labels cannot be placeholders only
- Minimum 44px interactive target
