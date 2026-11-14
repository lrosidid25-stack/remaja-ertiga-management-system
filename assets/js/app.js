/* ============================================================
   REMAJA ERTIGA — App JS (ringkas, tanpa dependensi)
   ============================================================ */
(function () {
    'use strict';

    var d = document;

    // Menu mobile
    var toggle = d.getElementById('navToggle');
    var menu = d.getElementById('navMenu');
    if (toggle && menu) {
        toggle.addEventListener('click', function () {
            menu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', menu.classList.contains('open'));
        });
    }

    // Alert hilang otomatis
    setTimeout(function () {
        d.querySelectorAll('.alert').forEach(function (el) {
            el.style.transition = 'opacity .35s, transform .35s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px)';
            setTimeout(function () { el.remove(); }, 380);
        });
    }, 6000);

    // Konfirmasi (delegasi event: satu listener untuk semua)
    d.addEventListener('click', function (e) {
        var el = e.target.closest('[data-confirm]');
        if (el && !window.confirm(el.getAttribute('data-confirm'))) {
            e.preventDefault();
            e.stopPropagation();
        }
        var pr = e.target.closest('[data-print]');
        if (pr) {
            e.preventDefault();
            window.print();
        }
    });

    // Input nominal: hanya angka
    d.addEventListener('input', function (e) {
        if (e.target.matches && e.target.matches('input[data-numeric]')) {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        }
    });

    // Hitung nominal iuran: nominal/hari x jumlah hari
    var perHari = d.querySelector('[data-per-hari]');
    var tglMulai = d.querySelector('[data-tgl-mulai]');
    var tglSelesai = d.querySelector('[data-tgl-selesai]');
    var jmlHari = d.querySelector('[data-jml-hari]');
    var total = d.querySelector('[data-total-nominal]');

    function hitungIuran() {
        if (!tglMulai || !tglSelesai || !jmlHari) return;
        if (!tglMulai.value || !tglSelesai.value) return;
        var hari = Math.floor((new Date(tglSelesai.value) - new Date(tglMulai.value)) / 86400000) + 1;
        if (isNaN(hari)) return;
        if (hari < 1) hari = 0;
        jmlHari.value = hari;
        if (perHari && total) {
            var rp = hari * (parseInt(perHari.getAttribute('data-per-hari'), 10) || 0);
            total.textContent = 'Rp' + rp.toLocaleString('id-ID');
            var hidden = d.querySelector('input[name=nominal]');
            if (hidden) hidden.value = rp;
        }
    }
    if (tglMulai && tglSelesai) {
        tglMulai.addEventListener('change', hitungIuran);
        tglSelesai.addEventListener('change', hitungIuran);
        hitungIuran();
    }
})();
