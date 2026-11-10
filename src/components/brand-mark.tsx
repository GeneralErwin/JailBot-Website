export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark${small ? " brand-mark--small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <path d="M5.5 5.5h17.2c4.4 0 7.8 2.8 7.8 7 0 3.1-1.8 5.2-4.4 6.2 3.2.8 5.4 3.1 5.4 6.2 0 4.7-3.7 7.6-8.7 7.6H5.5V5.5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 12h9.6c2.2 0 3.5 1.1 3.5 2.8 0 1.8-1.3 2.9-3.5 2.9H12V12Zm0 10h10.8c2.4 0 3.7 1.1 3.7 2.9s-1.4 2.9-3.7 2.9H12V22Z" fill="currentColor" />
        <path d="M2.8 1.8v32.4" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}
