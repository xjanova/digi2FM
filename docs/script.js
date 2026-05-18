/* =========================================================
   Digi2FM landing — interactive bits
   ========================================================= */

(() => {
  // ----- Animated FSK waveform on the hero canvas -----
  const canvas = document.getElementById('waveform');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }

  window.addEventListener('resize', resize);
  resize();

  // FSK parameters (tone freqs are arbitrary visually — not strict Hz)
  const MARK = 1.4;    // higher freq scaling
  const SPACE = 0.7;   // lower freq scaling
  const BAUD = 6;      // bits visible per "second" of canvas
  let bits = [];

  function regenBits() {
    bits = Array.from({ length: 64 }, () => Math.random() > 0.5 ? 1 : 0);
  }
  regenBits();
  setInterval(regenBits, 4200);

  let t = 0;

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background grid lines (horizontal)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical bit boundaries
    const bitWidth = w / 16; // 16 bits visible at a time
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i <= 16; i++) {
      const x = i * bitWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // The wave
    const offset = (t * BAUD) % 1;
    const startBit = Math.floor(t * BAUD) % bits.length;

    // Glow under the line
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0, 212, 255, 0.0)');
    grad.addColorStop(0.5, 'rgba(0, 212, 255, 0.18)');
    grad.addColorStop(1, 'rgba(255, 46, 147, 0.18)');

    // Main waveform line
    ctx.lineWidth = 2.4 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, '#00d4ff');
    lineGrad.addColorStop(1, '#ff2e93');
    ctx.strokeStyle = lineGrad;

    ctx.beginPath();

    const SAMPLES = 600;
    const centerY = h / 2;
    const amp = h * 0.36;

    for (let i = 0; i <= SAMPLES; i++) {
      const x = (i / SAMPLES) * w;
      const bitIdx = (startBit + Math.floor((i / SAMPLES) * 16)) % bits.length;
      const bit = bits[bitIdx];
      const freq = bit === 1 ? MARK : SPACE;

      // Sinusoid; phase uses absolute x so freq changes show as instant
      const phase = (x / w) * 16 * Math.PI * freq + t * 4;
      const y = centerY + Math.sin(phase) * amp;

      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Bit overlay — colored shaded regions
    for (let i = 0; i < 16; i++) {
      const bitIdx = (startBit + i) % bits.length;
      const bit = bits[bitIdx];
      const x = i * bitWidth - offset * bitWidth;
      ctx.fillStyle = bit === 1
        ? 'rgba(0, 212, 255, 0.06)'
        : 'rgba(255, 46, 147, 0.06)';
      ctx.fillRect(x, 0, bitWidth, h);
    }

    // Frequency labels (top corners)
    ctx.font = `${11 * dpr}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('MARK · 1200 Hz', 14 * dpr, 22 * dpr);
    ctx.fillStyle = '#ff2e93';
    const rightLabel = 'SPACE · 2200 Hz';
    const m = ctx.measureText(rightLabel);
    ctx.fillText(rightLabel, w - m.width - 14 * dpr, 22 * dpr);

    t += 0.016;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // ----- Bit stream ticker -----
  const bitstreamEl = document.getElementById('bitstream');
  if (bitstreamEl) {
    function randomBits(groups = 12) {
      return Array.from({ length: groups }, () =>
        Array.from({ length: 8 }, () => Math.random() > 0.5 ? 1 : 0).join('')
      ).join(' ');
    }
    setInterval(() => {
      bitstreamEl.textContent = randomBits();
    }, 350);
  }

  // ----- Section reveal on scroll -----
  const revealEls = document.querySelectorAll(
    '.section, .stat, .feature, .pipeline__step, .arch-card, .usecase, .flow-visual'
  );
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    io.observe(el);
  });
})();
