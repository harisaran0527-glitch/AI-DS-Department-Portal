import React, { useEffect, useRef } from "react";

type P = {
  x: number;
  y: number;
  z: number;
  r: number;
  vy: number;
  vx: number;
  a: number;
  tw: number;
  ph: number;
};

type Streak = {
  y: number;
  x: number;
  w: number;
  v: number;
  a: number;
};

function makeSprite(size: number, r: number, g: number, b: number) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  if (!x) return null;
  const grd = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
  grd.addColorStop(0.55, `rgba(${r},${g},${b},0.14)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grd;
  x.fillRect(0, 0, size, size);
  return c;
}

export const ParticleField: React.FC<{
  mouse?: React.MutableRefObject<{ x: number; y: number }>;
  intensity?: number;
}> = ({ mouse, intensity = 1 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const defaultMouse = useRef({ x: 0, y: 0 });
  const mouseRef = mouse || defaultMouse;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;

    // Soft Blue and Cyan particles matching Dark Blue + White theme
    const spriteBlue = makeSprite(64, 90, 185, 255);
    const spriteCyan = makeSprite(64, 34, 211, 238);
    const spriteWhite = makeSprite(64, 240, 248, 255);

    let particles: P[] = [];
    let streaks: Streak[] = [];

    const build = () => {
      const area = w * h;
      const count = Math.round(Math.min(90, Math.max(30, area / 16000)));
      particles = new Array(count).fill(0).map(() => {
        const z = 0.18 + Math.random() * 0.82;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          r: (0.6 + Math.random() * 2.2) * z,
          vy: -(2 + Math.random() * 7) * z * 0.05,
          vx: (Math.random() - 0.5) * 0.12 * z,
          a: 0.15 + Math.random() * 0.5,
          tw: 0.4 + Math.random() * 1.5,
          ph: Math.random() * Math.PI * 2,
        };
      });
      streaks = new Array(6).fill(0).map(() => ({
        y: Math.random() * h,
        x: Math.random() * w,
        w: 120 + Math.random() * 400,
        v: 0.12 + Math.random() * 0.45,
        a: 0.04 + Math.random() * 0.1,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    resize();
    window.addEventListener("resize", resize);

    let px = 0;
    let py = 0;
    let t = 0;

    const frame = () => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      t += 0.016;

      px += (mouseRef.current.x * 24 - px) * 0.04;
      py += (mouseRef.current.y * 16 - py) * 0.04;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const boost = intensityRef.current;

      for (const s of streaks) {
        s.x += s.v;
        if (s.x - s.w > w) {
          s.x = -s.w;
          s.y = Math.random() * h;
          s.w = 120 + Math.random() * 400;
        }
        const g = ctx.createLinearGradient(s.x - s.w, 0, s.x, 0);
        g.addColorStop(0, "rgba(70,170,255,0)");
        g.addColorStop(0.5, `rgba(34,211,238,${s.a * boost})`);
        g.addColorStop(1, "rgba(70,170,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(s.x - s.w, s.y + py * 0.35, s.w, 1);
      }

      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(t * 0.33 + p.ph) * 0.07 * p.z;
        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;

        const tw = 0.6 + 0.4 * Math.sin(t * p.tw + p.ph);
        const size = p.r * 10;
        const alpha = Math.min(1, p.a * tw * boost);
        ctx.globalAlpha = alpha;
        const sprite = p.z > 0.85 ? spriteWhite : p.z > 0.5 ? spriteCyan : spriteBlue;
        if (sprite) {
          ctx.drawImage(
            sprite,
            p.x - size / 2 + px * p.z,
            p.y - size / 2 + py * p.z,
            size,
            size
          );
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mouseRef]);

  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-0" />;
};
