import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Couronne BECTANCEMAX (contour). */
export function Crown(props: IconProps) {
  return (
    <svg viewBox="0 0 64 40" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 34 L3.5 9.5 L18.5 20.5 L32 3.5 L45.5 20.5 L60.5 9.5 L57 34 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Trait de pinceau vert sous le logo. */
export function BrushUnderline(props: IconProps) {
  return (
    <svg viewBox="0 0 160 14" aria-hidden="true" {...props}>
      <path
        d="M2 10.6 C 30 5.2, 78 2.4, 157 4.2 C 158.6 4.3, 158.6 6.1, 157 6.3 C 96 6.9, 52 8.6, 4.4 12.6 C 1.6 12.8, 0.6 11, 2 10.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Avion en papier Telegram. */
export function TelegramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M2.6 11.1 20.4 4.2c.85-.33 1.65.4 1.43 1.3l-3.03 14.3c-.2.92-1.25 1.33-2 .78l-4.62-3.4-2.36 2.27c-.42.4-1.12.2-1.25-.37l-.98-4.3-5-1.66c-.95-.32-.97-1.65-.03-2.02Z"
        fill="currentColor"
      />
      <path d="m8.58 14.88 9.1-7.43-7.04 8.2-.33 3.6Z" fill="currentColor" opacity=".45" />
    </svg>
  );
}

/** Trois barres pleines croissantes (accès « statistiques »). */
export function BarsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="3" y="13" width="4.4" height="8" rx="1.2" />
      <rect x="9.8" y="8" width="4.4" height="13" rx="1.2" />
      <rect x="16.6" y="3" width="4.4" height="18" rx="1.2" />
    </svg>
  );
}

/** Ballon de football (contour). */
export function FootballIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9.6" />
      <path d="m12 8.1 3.7 2.7-1.4 4.4H9.7l-1.4-4.4Z" fill="currentColor" />
      <path d="M12 8.1V3.2M15.7 10.8l4.4-1.6M14.3 15.2l2.8 3.9M9.7 15.2l-2.8 3.9M8.3 10.8 3.9 9.2" />
      <path d="M9.6 3.4 12 5l2.4-1.6M19.9 8.2l-.2 3.1 1.6 1.3M16.1 20.4l-1-2.6 1.7-1.5M7.9 20.4l1-2.6-1.7-1.5M4.1 8.2l.2 3.1-1.6 1.3" strokeWidth="1.3" />
    </svg>
  );
}

/** Balle de tennis (contour). */
export function TennisIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9.6" />
      <path d="M5.4 5.1c3.4 3.6 3.4 10.2 0 13.8M18.6 5.1c-3.4 3.6-3.4 10.2 0 13.8" />
    </svg>
  );
}
