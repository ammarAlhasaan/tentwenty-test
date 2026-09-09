// Root fallback, outside the application shell: it covers the login page and
// anything else that is not under (app), which has its own shell-shaped one.
export default function Loading() {
  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      aria-busy
      role="status"
    >
      <span className="sr-only">Loading</span>
      <div className="size-6 animate-pulse rounded-full bg-muted" aria-hidden />
    </div>
  );
}
