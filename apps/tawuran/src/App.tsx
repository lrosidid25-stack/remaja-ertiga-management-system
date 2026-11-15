import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, Wifi, WifiOff, Boxes } from 'lucide-react';

/**
 * Layar status sementara.
 *
 * Folder `src/` asli dari proyek AI Studio belum diunggah, jadi bundel web
 * masih kosong. Layar ini hanya memastikan APK terpasang & berjalan di HP
 * (WebView, aset lokal, deteksi offline) sampai sumber game dimasukkan.
 *
 * Setelah `src/` asli diunggah, ganti komponen ini dengan game sebenarnya.
 */
export default function App() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const platform = Capacitor.getPlatform();

  return (
    <main className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(249,115,22,.22), transparent 60%), radial-gradient(circle at 50% 100%, rgba(56,189,248,.14), transparent 55%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <p className="font-mono text-[11px] tracking-[0.35em] text-orange-400/90">
          APK SIAP DIPASANG
        </p>

        <h1
          className="mt-3 text-5xl font-extrabold leading-none tracking-tight"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          TAWURAN
          <span className="block text-2xl font-bold text-zinc-400">
            Jalanan Sore
          </span>
        </h1>

        <div className="mt-7 space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left text-sm">
          <Row
            icon={<Smartphone className="h-4 w-4 text-emerald-400" />}
            label="Platform"
            value={platform}
          />
          <Row
            icon={
              online ? (
                <Wifi className="h-4 w-4 text-emerald-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-amber-400" />
              )
            }
            label="Jaringan"
            value={online ? 'Online' : 'Offline (tetap jalan)'}
          />
          <Row
            icon={<Boxes className="h-4 w-4 text-sky-400" />}
            label="Bundel game"
            value="Menunggu src/"
          />
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-zinc-400">
          Aplikasi ini sudah terpasang dan berjalan normal di HP kamu. Isi game
          belum ikut karena folder <code className="text-zinc-200">src/</code>{' '}
          (kode utama dari AI Studio) belum diunggah ke repo — hanya file
          konfigurasi yang terkirim.
        </p>

        <p className="mt-3 font-mono text-[11px] text-zinc-600">
          build {__APP_BUILD__}
        </p>
      </div>
    </main>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
      <span className="flex items-center gap-2 text-zinc-400">
        {icon}
        {label}
      </span>
      <span className="font-medium text-zinc-100">{value}</span>
    </div>
  );
}
