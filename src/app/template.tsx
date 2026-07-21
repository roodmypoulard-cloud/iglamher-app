// App Router templates re-mount on every navigation, so this wraps each page
// in a fresh enter animation — the native-feeling transition between screens.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
