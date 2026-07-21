// App Router templates re-mount on every navigation, so this wraps each page in
// a fresh enter animation. IMPORTANT: opacity-only (no transform) — a transform
// here would establish a containing block and break `position: fixed` on the
// BottomNav rendered inside it (it would anchor to the page, not the viewport).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
