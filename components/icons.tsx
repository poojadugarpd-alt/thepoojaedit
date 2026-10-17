type P = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode, fill = false) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    {children}
  </svg>
);

export const WhatsAppIcon = ({ size = 20, className }: P) =>
  svg(
    size,
    className,
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm.01 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />,
    true,
  );

export const InstagramIcon = ({ size = 20, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>,
  );

export const YouTubeIcon = ({ size = 20, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="m10 9.2 5 2.8-5 2.8z" fill="currentColor" />
    </>,
  );

export const MailIcon = ({ size = 20, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </>,
  );

export const PlayIcon = ({ size = 20, className }: P) =>
  svg(size, className, <path d="M8 5.5v13l11-6.5z" />, true);

export const LayersIcon = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="7" y="3" width="14" height="14" rx="2.5" />
      <path d="M17 21H5.5A2.5 2.5 0 0 1 3 18.5V7" />
    </>,
  );

export const ArrowIcon = ({ size = 18, className }: P) =>
  svg(size, className, <path d="M5 12h14m-5-5 5 5-5 5" />);

export const CloseIcon = ({ size = 20, className }: P) =>
  svg(size, className, <path d="M6 6l12 12M18 6 6 18" />);

export const CheckIcon = ({ size = 18, className }: P) =>
  svg(size, className, <path d="m5 12.5 4.5 4.5L19 7.5" />);
