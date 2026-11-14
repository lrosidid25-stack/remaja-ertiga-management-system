/* ============================================================
   REMAJA ERTIGA — App JS
   ============================================================ */
(function () {
    'use strict';

    // Mobile nav toggle
    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('navMenu');
    if (toggle && menu) {
        toggle.addEventListener('click', function () {
            menu.classList.toggle('open');
        });
    }

    // Auto-hide flash alerts
    document.querySelectorAll('.alert').forEach(function (el) {
        setTimeout(function () {
            el.style.transition = 'opacity .4s, transform .4s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px)';
            setTimeout(function () { el.remove(); }, 420);
        }, 6000);
    });

    // Konfirmasi untuk elemen dengan data-confirm
    document.querySelectorAll('[data-confirm]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            if (!window.confirm(el.getAttribute('data-confirm'))) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });

    // Format input nominal → hanya angka
    document.querySelectorAll('input[data-numeric]').forEach(function (el) {
        el.addEventListener('input', function () {
            el.value = el.value.replace(/[^\d]/g, '');
        });
    });

    // Cetak kartu / halaman
    document.querySelectorAll('[data-print]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            window.print();
        });
    });

    // Hitung otomatis nominal iuran: nominal/hari × jumlah hari
    var perHari = document.querySelector('[data-per-hari]');
    var tglMulai = document.querySelector('[data-tgl-mulai]');
    var tglSelesai = document.querySelector('[data-tgl-selesai]');
    var jmlHari = document.querySelector('[data-jml-hari]');
    var total = document.querySelector('[data-total-nominal]');

    function hitungIuran() {
        if (!tglMulai || !tglSelesai || !jmlHari) return;
        var a = tglMulai.value, b = tglSelesai.value;
        if (!a || !b) return;
        var d1 = new Date(a), d2 = new Date(b);
        var hari = Math.floor((d2 - d1) / 86400000) + 1;
        if (isNaN(hari)) return;
        if (hari < 1) hari = 0;
        jmlHari.value = hari;
        if (perHari && total) {
            var nominal = parseInt(perHari.getAttribute('data-per-hari'), 10) || 0;
            var rp = hari * nominal;
            total.textContent = 'Rp' + rp.toLocaleString('id-ID');
            var hidden = document.querySelector('input[name=nominal]');
            if (hidden) hidden.value = rp;
        }
    }
    if (tglMulai && tglSelesai) {
        tglMulai.addEventListener('change', hitungIuran);
        tglSelesai.addEventListener('change', hitungIuran);
        hitungIuran();
    }
})();
