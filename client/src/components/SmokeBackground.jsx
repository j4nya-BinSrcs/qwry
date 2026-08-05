import { useEffect, useRef } from "react";

const COUNT = 170;

export default function SmokeBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let pointer = { x: -1000, y: -1000, active: false };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    function spawn(initial) {
      return {
        x: W + 20 - Math.random() * 90,
        y: H + 10 + (Math.random() - 0.5) * 40,
        r: 20 + Math.random() * 34,
        alpha: 0.09 + Math.random() * 0.1,
        vx: -(0.25 + Math.random() * 0.6),
        vy: -(0.35 + Math.random() * 0.7),
        grow: 0.5 + Math.random() * 0.9,
        life: initial ? Math.random() * 8 : 0,
        maxLife: 7 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 0.012,
      };
    }

    const particles = Array.from({ length: COUNT }, () => spawn(true));

    let last = performance.now();

    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const isDark = document.documentElement.classList.contains("dark");
      const rgb = isDark ? "226,226,230" : "118,118,128";
      ctx.globalCompositeOperation = isDark ? "screen" : "source-over";

      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.life += dt;
        p.vy += p.drift * dt * 60;
        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;
        p.r += p.grow * dt;

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d = Math.hypot(dx, dy);
          const R = 220;
          if (d < R && d > 0.01) {
            const f = (1 - d / R) * 26 * dt;
            p.x += (dx / d) * f * 60;
            p.y += (dy / d) * f * 60;
          }
        }

        if (p.life > p.maxLife || p.x < -120 || p.y < -120 || p.x > W + 160) {
          Object.assign(p, spawn(false));
        }

        const fade = Math.min(1, p.life * 0.9) * Math.max(0, 1 - p.life / p.maxLife);
        const a = p.alpha * fade;
        if (a <= 0.002) continue;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
        g.addColorStop(0.4, `rgba(${rgb},${(a * 0.5).toFixed(3)})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
  );
}
