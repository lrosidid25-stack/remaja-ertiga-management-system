# Tekstur game (`src/assets/images/`)

Kedua tekstur di-import langsung oleh `engine.ts` / `environment.ts`, jadi
Vite yang mem-bundel-nya (nama file di-hash, ikut masuk APK):

```ts
import texAsphalt from '../assets/images/tex_asphalt_street_1794731085204.jpg';
import texConcrete from '../assets/images/tex_concrete_wall_1794731086713.jpg';
```

| File | Ukuran | Pemakaian yang disarankan |
| --- | --- | --- |
| `tex_asphalt_street_1794731085204.jpg` | 1024×1024, 318 KB | permukaan jalan aspal (tileable) |
| `tex_concrete_wall_1794731086713.jpg` | 1024×1024, 364 KB | dinding beton / pagar (tileable) |

## Cara memuat di Three.js

Tekstur di proyek ini **di-import sebagai modul** (bukan path string), supaya
Vite mem-bundel dan memberi hash nama file — aman dipakai di WebView APK:

```ts
import * as THREE from 'three';
import texAsphalt from '../assets/images/tex_asphalt_street_1794731085204.jpg';

const loader = new THREE.TextureLoader();
const asphalt = loader.load(texAsphalt);

asphalt.colorSpace = THREE.SRGBColorSpace;
asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
asphalt.repeat.set(8, 8);   // sesuaikan skala dunia
asphalt.anisotropy = 4;     // batasi agar ringan di HP kelas menengah
```

Hindari path absolut seperti `'/assets/images/…'`: bundel APK dimuat dari
`https://localhost` dengan `base: './'`, sehingga path absolut akan gagal.

## Menambah aset lain

- Gambar/tekstur → `src/assets/images/`, lalu `import` seperti di atas.
- Audio → `src/assets/audio/` (atau dibuat prosedural seperti `audio.ts`).
- Model 3D dibuat prosedural di `models.ts`; kalau nanti pakai `.glb`, taruh di
  `public/models/` (otomatis ikut ke APK) dan muat dengan path relatif.
- Jaga ukuran: tekstur 1024×1024 sudah cukup untuk layar HP; hindari > 2048.
- Cek ukuran hasil bundel: `npm run build` lalu `du -sh dist`.
