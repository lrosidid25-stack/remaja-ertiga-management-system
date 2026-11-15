import React, { useEffect, useRef, useState } from 'react';
import { Flame, Shield, Swords, Wind } from 'lucide-react';

interface TouchControlsProps {
  ammoPetasan: number;
  petasanCooldown: number;
  onMove: (dx: number, dy: number) => void;
  onAttack: () => void;
  onThrowPetasan: () => void;
  onBlockChange: (active: boolean) => void;
  onDodge: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  ammoPetasan,
  petasanCooldown,
  onMove,
  onAttack,
  onThrowPetasan,
  onBlockChange,
  onDodge,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showTouch, setShowTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const smallViewport = window.innerWidth < 1024;
      setShowTouch(coarse || smallViewport);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  if (!showTouch) return null;

  const maxRadius = 36;

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    onMove(dx / maxRadius, dy / maxRadius);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 [@media(max-height:520px)]:bottom-2.5 z-20 pointer-events-none px-3 sm:px-5 flex items-end justify-between">
      {/* Left Virtual Analog Pad */}
      <div
        ref={padRef}
        role="group"
        aria-label="Analog Gerak"
        onPointerDown={(e) => {
          e.preventDefault();
          activePointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerId.current === e.pointerId) {
            updateStick(e.clientX, e.clientY);
          }
        }}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        className="pointer-events-auto relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-950/75 border-2 border-zinc-600/80 flex items-center justify-center touch-none"
      >
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/90 border-2 border-white shadow-lg transition-transform duration-75"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right Non-Overlapping 2x2 Combat Action Grid */}
      <div className="pointer-events-auto grid grid-cols-2 gap-2.5">
        <button
          type="button"
          aria-label="Hindar"
          onPointerDown={(e) => {
            e.preventDefault();
            onDodge();
          }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-900/90 border border-zinc-600 text-sky-300 flex flex-col items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
        >
          <Wind className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold">Hindar</span>
        </button>

        <button
          type="button"
          aria-label="Lempar Petasan"
          disabled={ammoPetasan <= 0 || petasanCooldown > 0}
          onPointerDown={(e) => {
            e.preventDefault();
            onThrowPetasan();
          }}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 active:scale-95 cursor-pointer ${
            ammoPetasan > 0 && petasanCooldown <= 0
              ? 'bg-amber-600/92 border-amber-400 text-white'
              : 'bg-zinc-900/75 border-zinc-700 text-zinc-500'
          }`}
        >
          <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold font-mono-num">
            {petasanCooldown > 0 ? `${petasanCooldown}s` : `x${ammoPetasan}`}
          </span>
        </button>

        <button
          type="button"
          aria-label="Tangkis"
          onPointerDown={(e) => {
            e.preventDefault();
            onBlockChange(true);
          }}
          onPointerUp={() => onBlockChange(false)}
          onPointerCancel={() => onBlockChange(false)}
          onPointerLeave={() => onBlockChange(false)}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-900/90 border border-zinc-600 text-emerald-300 flex flex-col items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
        >
          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold">Tangkis</span>
        </button>

        <button
          type="button"
          aria-label="Serang"
          onPointerDown={(e) => {
            e.preventDefault();
            onAttack();
          }}
          className="w-14 h-14 sm:w-16 sm:h-16 -mt-1 -ml-1 rounded-xl bg-red-600/95 border-2 border-red-400 text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-lg cursor-pointer"
        >
          <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="text-[11px] font-bold">Serang</span>
        </button>
      </div>
    </div>
  );
};
