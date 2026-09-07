/**
 * Keyboard/screen-reader skip link. Visually hidden until focused (master spec
 * §4: keyboard controls, visible focus).
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
    >
      Skip to main content
    </a>
  );
}
