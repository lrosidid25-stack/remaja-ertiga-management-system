# Tekstur game (`public/textures/`)

Aset di folder ini disalin apa adanya ke dalam APK (Vite `public/`), jadi
**tidak perlu** di-import lewat bundler.

| File | Ukuran | Pemakaian yang disarankan |
| --- | --- | --- |
| `asphalt-street.jpg` | 1024×1024, 318 KB | permukaan jalan aspal (tileable) |
| `concrete-wall.jpg` | 1024×1024, 364 KB | dinding beton / pagar (tileable) |

## Cara memuat di Three.js

Pakai path **relatif** (jangan diawali `/`). Vite di proyek ini memakai
`base: './'` supaya bundel juga jalan di dalam WebView Android
(`https://localhost`), dan path absolut akan gagal di sana.

```ts
import * as THREE from 'three';

const loader = new THREE.TextureLoader();

const asphalt = loader.load('textures/asphalt-street.jpg');
asphalt.colorSpace = THREE.SRGBColorSpace;
asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
asphalt.repeat.set(8, 8);      // sesuaikan dengan skala dunia
asphalt.anisotropy = 4;        // batasi agar ringan di HP kelas menengah
```

Untuk beberapa tekstur sekaligus, `THREE.LoadingManager` lebih rapi:

```ts
const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const asphalt  = loader.load('textures/asphalt-street.jpg');
const concrete = loader.load('textures/concrete-wall.jpg');
manager.onLoad = () => console.log('semua tekstur siap');
```

## Menambah aset lain

- Taruh model `.glb`/`.gltf` di `public/models/`, audio di `public/audio/`.
- Nama file pakai huruf kecil dan tanda hubung (`concrete-wall.jpg`) supaya aman
  di semua sistem file.
- Jaga ukuran: tekstur 1024×1024 sudah cukup untuk layar HP; hindari > 2048.
- Cek ukuran total: `du -sh public/` — semua ikut masuk ke dalam APK.
