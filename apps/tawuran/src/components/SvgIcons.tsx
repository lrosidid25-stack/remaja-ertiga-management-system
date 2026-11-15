import React from 'react';
import type { WeaponId } from '../game/types';

export const TitleEmblemSvg: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <svg
    viewBox="0 0 420 132"
    className="w-full max-w-[380px] h-auto"
    role="img"
    aria-label="Tawuran: Jalanan Sore"
  >
    {/* Background stencil bar */}
    <path
      d="M8 20 L396 14 L388 86 L2 92 Z"
      fill={isDark ? '#18181b' : '#18181b'}
      stroke="#ea580c"
      strokeWidth="3"
    />
    {/* Crossed sickle & sprocket crest on left */}
    <g transform="translate(22, 24)">
      <circle
        cx="28"
        cy="28"
        r="20"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="4"
        strokeDasharray="6 4"
      />
      <circle cx="28" cy="28" r="8" fill="#18181b" stroke="#f59e0b" strokeWidth="2.5" />
      <path
        d="M12 48 L36 16 Q48 4 54 14 Q44 18 38 28 L18 52 Z"
        fill="#e4e4e7"
        stroke="#09090b"
        strokeWidth="2"
      />
    </g>
    {/* Display lettering */}
    <text
      x="94"
      y="64"
      fill="#fafafa"
      fontFamily="'Barlow Condensed', sans-serif"
      fontWeight="800"
      fontSize="48"
      letterSpacing="2"
    >
      TAWURAN
    </text>
    {/* Subtitle plate */}
    <path d="M92 78 L340 75 L335 112 L88 115 Z" fill="#dc2626" />
    <text
      x="106"
      y="102"
      fill="#fefce8"
      fontFamily="'Barlow Condensed', sans-serif"
      fontWeight="700"
      fontSize="24"
      letterSpacing="3"
    >
      JALANAN SORE
    </text>
  </svg>
);

export const WeaponSvgIcon: React.FC<{ weapon: WeaponId; className?: string }> = ({
  weapon,
  className = 'w-5 h-5',
}) => {
  switch (weapon) {
    case 'sabit_modif':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M4 20 L11 12"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M11 12 Q16 5 21 5 Q18 11 14 14 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );
    case 'gir_sabuk':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M4 19 Q9 16 13 11"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle
            cx="16"
            cy="8"
            r="4.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeDasharray="2.2 1.8"
          />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'kayu_paku':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M5 19 L17 7 L19 9 L7 21 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M14 5 L17 7 M18 3 L19 7 M21 9 L18 10"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'penggaris_baja':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M4 18 L18 4 L20 6 L6 20 Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 14 L10 16 M11 11 L13 13 M14 8 L16 10"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
  }
};

export const PetasanSvgIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    <rect
      x="8"
      y="8"
      width="7"
      height="12"
      rx="1.5"
      transform="rotate(20 11.5 14)"
      fill="#dc2626"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M14 7 Q16 4 19 4"
      stroke="#fbbf24"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="19.5" cy="4" r="1.8" fill="#f97316" />
  </svg>
);
