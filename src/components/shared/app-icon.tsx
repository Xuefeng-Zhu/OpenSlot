import { cn } from "@/lib/utils";

interface AppIconProps {
  className?: string;
}

export function AppIcon({ className }: AppIconProps) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="app-icon-check-gradient"
          x1="39"
          x2="58"
          y1="54"
          y2="39"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2857ff" />
          <stop offset="1" stopColor="#1f4eff" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="16" fill="#fff" />
      <rect x="3.75" y="3.75" width="56.5" height="56.5" rx="15.25" stroke="#dbe5f5" strokeWidth="1.5" />
      <path
        d="M20 19h24M20 19h-2c-6.1 0-11 4.9-11 11v17c0 6.1 4.9 11 11 11h17M44 19h2c6.1 0 11 4.9 11 11v9"
        stroke="#061943"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.75"
      />
      <path
        d="M20 12v10M44 12v10"
        stroke="#061943"
        strokeLinecap="round"
        strokeWidth="4.75"
      />
      <circle cx="22" cy="34" r="3" fill="#061943" />
      <circle cx="32" cy="34" r="3" fill="#061943" />
      <circle cx="42" cy="34" r="3" fill="#061943" />
      <circle cx="22" cy="45" r="3" fill="#061943" />
      <circle cx="32" cy="45" r="3" fill="#061943" />
      <path
        d="m39 47 7 7 14-15"
        stroke="url(#app-icon-check-gradient)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5.75"
      />
    </svg>
  );
}
