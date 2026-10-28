const ICON_PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: (
    <path d="M12 3c3 3.8 5 6.2 5 9.2A5 5 0 017 12.2c0-1.9.9-3.1 2-4.2.1 1.9.9 2.9 1.8 3.2.4-2.7.8-5.2 1.2-8.2z" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0112.4 0" />
      <path d="M16.2 4.8a3.4 3.4 0 010 6.4" />
      <path d="M17.6 20a6.4 6.4 0 00-2.5-5" />
    </>
  ),
  bookmark: <path d="M6.5 3.5h11V21l-5.5-3.8L6.5 21V3.5z" />,
  heart: <path d="M12 20s-7.2-4.4-7.2-9.1A4.1 4.1 0 0112 8.3a4.1 4.1 0 017.2 2.6c0 4.7-7.2 9.1-7.2 9.1z" />,
  bell: (
    <>
      <path d="M18 8.5a6 6 0 10-12 0c0 5.7-2 6.8-2 6.8h16s-2-1.1-2-6.8z" />
      <path d="M10.4 19.5a2 2 0 003.2 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  pen: <path d="M4 20h4.2L20 8.2 15.8 4 4 15.8V20z" />,
  star: <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8L6.8 19.7l1-5.8-4.3-4.1 5.9-.9L12 3.6z" />,
  check: <path d="M4.5 12.5l4.7 4.7L19.5 6.8" />,
  alert: (
    <>
      <path d="M10.3 4.4a2 2 0 013.4 0l7.3 12.7a2 2 0 01-1.7 3H4.7a2 2 0 01-1.7-3L10.3 4.4z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20c0-8.3 6-14 16-15 1 10.4-5.2 16-13.2 16H4v-1z" />
      <path d="M4.5 20c2.8-5.8 6.7-9 11.5-10.6" />
    </>
  ),
  chef: (
    <>
      <path d="M7 12.5a4 4 0 01-.6-8 4.6 4.6 0 015.6-1 4.6 4.6 0 015.6 1 4 4 0 01-.6 8v6.5H7v-6.5z" />
      <path d="M7 15.5h10" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 7.5l8 5.7 8-5.7" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
      <path d="M8 10V7.5a4 4 0 018 0V10" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 010 18 15 15 0 010-18" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8L11 3z" />
      <path d="M18.4 15l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9.9-2.2z" />
    </>
  ),
  reply: (
    <>
      <path d="M9.5 14.5L4 9l5.5-5.5" />
      <path d="M4 9h9.5a6 6 0 016 6v3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.9 13h9.2l.9-13" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M20.5 16.5l-5-5L6 20.5" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.8 8v5.6l-3.4 1.6v-7.2L3.5 5.5z" />,
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 11h17" />
    </>
  ),
  utc: (
    <>
      <path d="M7 3v7a2.6 2.6 0 005.2 0V3" />
      <path d="M9.6 12.6V21" />
      <path d="M17.5 3c-1.4 1.6-2 3.7-2 6.2s.6 3.2 2 4.3V21" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
      <path d="M8 5H5v2a3 3 0 003 3M16 5h3v2a3 3 0 01-3 3" />
      <path d="M12 13v4M9 21h6M10 17h4" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6l8-3z" />,
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M19 14v4.5a2 2 0 01-2 2H5.5a2 2 0 01-2-2V7a2 2 0 012-2H10" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5h6a3 3 0 013 3V20a2.5 2.5 0 00-2.5-2.5H4v-13z" />
      <path d="M20 4.5h-6a3 3 0 00-3 3V20a2.5 2.5 0 012.5-2.5H20v-13z" />
    </>
  ),
};

export function Icon({ name, size = 20, className = '', title, ...rest }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {paths}
    </svg>
  );
}
