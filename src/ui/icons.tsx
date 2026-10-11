import type { ReactNode } from 'react'

const P = ({ children, ...p }: { children: ReactNode } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
)
export const I = {
  sessions: <P><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></P>,
  timeline: <P><path d="M4 6h8M7 12h10M10 18h10" /></P>,
  findings: <P><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" /></P>,
  stats: <P><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></P>,
  search: <P><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></P>,
  compare: <P><path d="M8 3v18M16 3v18M4 8h4M16 16h4" /></P>,
  tools: <P><path d="M14 6l4 4-9 9H5v-4zM13 7l4 4" /></P>,
  workspaces: <P><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></P>,
  rules: <P><path d="M4 6h10M4 12h16M4 18h8" /><circle cx="18" cy="6" r="2" /><circle cx="16" cy="18" r="2" /></P>,
  sun: <P><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></P>,
  moon: <P><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></P>,
  check: <P><path d="M5 12.5l4.5 4.5L19 7.5" /></P>,
  redirect: <P><path d="M5 12h12M13 6l6 6-6 6" /></P>,
  warn: <P><path d="M12 5v9M12 18v.5" /></P>,
  cross: <P><path d="M6 6l12 12M18 6L6 18" /></P>,
  none: <P><circle cx="12" cy="12" r="6" /></P>,
  info: <P><path d="M12 11v6M12 7v.5" /></P>,
  cols: <P><path d="M4 5h16v14H4zM9 5v14M15 5v14" /></P>,
}
