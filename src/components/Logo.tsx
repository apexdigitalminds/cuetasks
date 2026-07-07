import React from 'react';

interface LogoProps {
  /** Pixel size of the square mark. */
  size?: number;
  className?: string;
  /** Unique suffix so multiple gradients on one page don't collide. */
  idSuffix?: string;
  title?: string;
}

/**
 * CueTasks brand mark: a "cue" speech swoosh cradling a checkmark, with
 * sound-wave arcs radiating to the right (voice + task + reminder).
 * Rendered in the brand indigo→violet→blue gradient.
 */
const Logo: React.FC<LogoProps> = ({ size = 40, className = '', idSuffix = 'default', title = 'CueTasks' }) => {
  const gid = `cue-grad-${idSuffix}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="16" y1="16" x2="112" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#6366F1" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* Cue swoosh — open speech ring with a tail, opening toward the waves */}
      <path
        d="M96.8 37.1 A40 40 0 1 0 96.8 82.9 L108 98"
        stroke={`url(#${gid})`}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Checkmark cradled inside the swoosh */}
      <path
        d="M46 62 L60 76 L86 44"
        stroke={`url(#${gid})`}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Sound-wave arcs radiating right */}
      <path d="M110.3 49.7 A16 16 0 0 1 110.3 70.3" stroke={`url(#${gid})`} strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M119.4 42 A28 28 0 0 1 119.4 78" stroke={`url(#${gid})`} strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.5" />
    </svg>
  );
};

export default Logo;
