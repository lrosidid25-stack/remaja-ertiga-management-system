import React from 'react';
import { ChevronRight, FastForward, Swords, Volume2, VolumeX } from 'lucide-react';
import type { CharacterConfig, ThemeMode } from '../game/types';

interface IntroOverlayProps {
  config: CharacterConfig;
  beat: number;
  totalBeats: number;
  theme: ThemeMode;
  muted: boolean;
  onAdvance: () => void;
  onSkip: () => void;
  onToggleMute: () => void;
}

interface StoryBeat {
  sceneTag: string;
  speaker: string;
  tone: 'hero' | 'rival' | 'narrator';
  line: string;
}

function getStoryBeats(config: CharacterConfig): StoryBeat[] {
  const school = config.schoolCode.trim() || 'STM 09';
  const name = config.name.trim() || 'Raka';
  return [
    {
      sceneTag: '16.45 WIB · DEPAN WARUNG PINGGIR JALAN',
      speaker: `${name} (${school})`,
      tone: 'hero',
      line: 'Niatnya cuma mau nongkrong dan beli gorengan bareng Bima dan Dika sepulang sekolah... eh, jalanan depan flyover malah dihadang rombongan sekolah sebelah.',
    },
    {
      sceneTag: 'PROVOKASI · PENGHADANGAN JALAN',
      speaker: 'Pentolan Sekolah Lawan',
      tone: 'rival',
      line: `Woy, bocah-bocah ${school}! Berani banget lewat wilayah kami? Tinggalin jaket sekolah kalian di aspal kalau masih mau pulang!`,
    },
    {
      sceneTag: 'DUAR!! · PETASAN PERINGATAN DILEMPAR',
      speaker: name,
      tone: 'hero',
      line: 'Gila, gorengan kami sampai mental kena petasan! Kalian yang mulai duluan—rapetin barisan, jangan ada yang mundur!',
    },
    {
      sceneTag: 'SIAP TEMPUR · BENTROKAN SORE',
      speaker: 'Narator Jalanan',
      tone: 'narrator',
      line: 'Tawuran antarsekolah tak terhindarkan. Maju bersama rekan sekubu, tangkis serangan, dan kuasai aspal sore ini!',
    },
  ];
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({
  config,
  beat,
  totalBeats,
  theme,
  muted,
  onAdvance,
  onSkip,
  onToggleMute,
}) => {
  const isDark = theme === 'dark';
  const beats = getStoryBeats(config);
  const safeBeat = Math.max(0, Math.min(beats.length - 1, beat));
  const current = beats[safeBeat];
  const isLastBeat = safeBeat >= totalBeats - 1;

  const toneBadgeClass =
    current.tone === 'rival'
      ? 'bg-red-600 text-white'
      : current.tone === 'hero'
        ? 'bg-amber-500 text-zinc-950'
        : 'bg-emerald-500 text-zinc-950';

  const toneBorderClass =
    current.tone === 'rival'
      ? 'border-l-red-500'
      : current.tone === 'hero'
        ? 'border-l-amber-500'
        : 'border-l-emerald-500';

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between"
      data-testid="intro-overlay"
    >
      {/* Top cinematic letterbox bar + controls */}
      <div className="bg-black/88 border-b border-zinc-800/70 px-3 sm:px-6 py-2 sm:py-3 [@media(max-height:520px)]:py-1.5 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded bg-red-600 text-white font-display font-bold text-xs sm:text-sm tracking-wider shrink-0">
            PROLOG {safeBeat + 1}/{totalBeats}
          </span>
          <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-zinc-300 truncate">
            {current.sceneTag}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center border border-zinc-700 bg-zinc-900/90 text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onSkip();
            }}
            aria-label="Lewati Animasi Pembukaan"
            className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-lg border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Lewati Intro</span>
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Bottom dialogue subtitle card inside letterbox zone */}
      <div className="bg-gradient-to-t from-black/95 via-black/82 to-transparent pt-6 pb-3 sm:pb-5 [@media(max-height:520px)]:pt-3 [@media(max-height:520px)]:pb-2 px-3 sm:px-6 pointer-events-auto">
        <div
          className={`max-w-3xl mx-auto rounded-xl border border-l-4 shadow-2xl px-4 py-3 sm:px-5 sm:py-4 [@media(max-height:520px)]:px-3.5 [@media(max-height:520px)]:py-2.5 ${toneBorderClass} ${
            isDark
              ? 'bg-zinc-950/92 border-zinc-800 text-zinc-100'
              : 'bg-white/95 border-zinc-300 text-zinc-900'
          }`}
        >
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 [@media(max-height:520px)]:mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold tracking-wide ${toneBadgeClass}`}
                >
                  {current.speaker}
                </span>

                <div className="flex items-center gap-1" aria-hidden="true">
                  {beats.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === safeBeat
                          ? 'w-5 bg-amber-400'
                          : idx < safeBeat
                            ? 'w-2 bg-zinc-500'
                            : 'w-2 bg-zinc-700/60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs sm:text-base [@media(max-height:520px)]:text-xs leading-snug sm:leading-relaxed font-medium">
                &ldquo;{current.line}&rdquo;
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onAdvance();
              }}
              aria-label={isLastBeat ? 'Mulai Bertarung' : 'Lanjut Adegan Berikutnya'}
              className={`shrink-0 min-h-[40px] sm:min-h-[44px] px-3.5 sm:px-4 rounded-lg font-display font-bold text-sm sm:text-base tracking-wide flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-[0.97] ${
                isLastBeat
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
              }`}
            >
              <span>{isLastBeat ? 'Tawuran!' : 'Lanjut'}</span>
              {isLastBeat ? <Swords className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
