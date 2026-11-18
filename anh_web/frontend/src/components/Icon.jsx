// Simple line icons drawn as inline SVG, so the page needs no icon package.
// Usage: <Icon name="clock" />  (size defaults to 16 px, colour follows the text)

const PATHS = {
  // time to first token
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  // decode speed
  gauge: (
    <>
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="M12 16l4-5" />
      <circle cx="12" cy="16" r="1.2" />
    </>
  ),
  // answer time
  hourglass: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9" />
      <path d="M16 3c0 5-8 5-8 9s8 4 8 9" />
    </>
  ),
  // energy
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  // vision encoder
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // LM prefill (a stack of tokens)
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  // decode (one word at a time)
  message: (
    <>
      <path d="M4 5h16v11H9l-5 4V5z" />
      <path d="M8 10h8" />
    </>
  ),
  // FPGA / chip
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </>
  ),
  // memory bandwidth
  memory: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="1.5" />
      <path d="M7 17v3M11 17v3M15 17v3M19 17v3M7 10.5h2M11 10.5h2M15 10.5h2" />
    </>
  ),
  // array size
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  // bits per weight
  binary: (
    <>
      <rect x="4" y="4" width="5" height="7" rx="2.5" />
      <path d="M16 4v7M14 4h2" />
      <path d="M6.5 13v7M4.5 13h2" />
      <rect x="15" y="13" width="5" height="7" rx="2.5" />
    </>
  ),
  code: (
    <>
      <path d="M8 7l-5 5 5 5" />
      <path d="M16 7l5 5-5 5" />
      <path d="M13.5 4l-3 16" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="0.6" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M10 4v16" />
    </>
  ),
  scatter: (
    <>
      <path d="M3 3v18h18" />
      <circle cx="8" cy="15" r="1.5" />
      <circle cx="12" cy="9" r="1.5" />
      <circle cx="17" cy="12" r="1.5" />
      <circle cx="18" cy="6" r="1.5" />
    </>
  ),
  lineChart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 6-7" />
    </>
  ),
  barChart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 9h8M7 13h12M7 17h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h13" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r="0.6" />
    </>
  ),
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
  ),
};

export default function Icon(props) {
  const size = props.size || 16;
  const shape = PATHS[props.name];
  if (!shape) {
    return null;
  }
  let className = "icon";
  if (props.className) {
    className = className + " " + props.className;
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
