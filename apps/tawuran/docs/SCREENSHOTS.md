# Tangkapan layar — Tawuran: Jalanan Sore

Diambil dari build web (AI Studio). APK berisi bundel yang sama — teks UI
`JALANAN SORE`, `GELOMBANG`, `Kustomisasi Karakter`, `Lewati Intro`, dan
`Sabuk Gir` terverifikasi ada di dalam berkas APK yang dirilis.

## Judul & kustomisasi

| Judul | Kustomisasi (Jaket Bomber) |
| --- | --- |
| ![Judul](screenshots/01-title.jpg) | ![Kustomisasi](screenshots/02-customizer-jaket-bomber.jpg) |

| Kustomisasi (Putih Abu + Helm Proyek) | Kustomisasi — Sabuk Gir 6 m |
| --- | --- |
| ![Kustomisasi 2](screenshots/03-customizer-putih-abu-helm.jpg) | ![Gir 6m](screenshots/04-customizer-gir-6m.jpg) |

Sabuk gir punya empat preset (2 m · 3,5 m · 5 m · 6 m). Semakin panjang →
jangkauan dan daya naik, tapi putaran makin lambat (6 m: daya 46, ayun 1,25 dtk).

## Prolog (4 beat)

| 1/4 — Ajakan | 2/4 — Provokasi |
| --- | --- |
| ![Prolog 1](screenshots/05-intro-1-ajakan.jpg) | ![Prolog 2](screenshots/06-intro-2-provokasi.jpg) |

| 3/4 — Petasan peringatan | 4/4 — Siap tempur |
| --- | --- |
| ![Prolog 3](screenshots/07-intro-3-petasan.jpg) | ![Prolog 4](screenshots/08-intro-4-siap-tempur.jpg) |

## Pertarungan

| Gir 2 m — jangkauan pendek | Gir 6 m — jangkauan panjang |
| --- | --- |
| ![Gir 2m](screenshots/09-gameplay-gir-2m.jpg) | ![Gir 6m](screenshots/10-gameplay-gir-6m.jpg) |

| Ayunan gir 6 m (busur panjang) | Tampilan HP (portrait) |
| --- | --- |
| ![Ayunan](screenshots/11-gameplay-ayunan-gir-6m.jpg) | ![Mobile](screenshots/12-mobile-portrait.jpg) |

## Catatan: kamera menembus tiang

![Kamera menembus tiang](screenshots/13-kamera-menembus-tiang.jpg)

Pada frame ini kamera masuk ke dalam tiang beton sehingga layar tertutup
tekstur dinding. `engine.ts` belum memakai `THREE.Raycaster` untuk menahan
kamera di depan penghalang — kalau mau diperbaiki, tambahkan raycast dari
pemain ke posisi kamera lalu dorong kamera ke titik tumbukan.

---

Semua gambar di folder ini sudah dikompres (1,9 MB total, dari 3,9 MB asli)
dan tidak ikut dibundel ke dalam APK — hanya untuk dokumentasi repo.
