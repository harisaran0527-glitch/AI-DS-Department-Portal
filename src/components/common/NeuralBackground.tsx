import React, { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  pulsePhase: number;
}

export const NeuralBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const colors = [
      'rgba(34, 211, 238, ',  // cyan
      'rgba(59, 130, 246, ',  // electric blue
      'rgba(147, 197, 253, ', // soft blue
    ];

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Node density: lighter on small screens, balanced on desktop
      const count = Math.min(preReduced ? 12 : 38, Math.max(16, Math.floor(width / 45)));
      nodes = [];

      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.35,
          vy: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.35,
          radius: 1.2 + Math.random() * 2.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    };

    const preReduced = prefersReducedMotion;
    init();

    window.addEventListener('resize', init);

    let t = 0;
    const maxDist = Math.min(160, Math.max(90, width / 9));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      t += 0.02;

      // 1. Draw interconnected neural network edges
      for (let i = 0; i < nodes.length; i++) {
        const ni = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const nj = nodes[j];
          const dx = ni.x - nj.x;
          const dy = ni.y - nj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.22;
            ctx.beginPath();
            ctx.moveTo(ni.x, ni.y);
            ctx.lineTo(nj.x, nj.y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // 2. Draw nodes & pulsing halos
      for (const node of nodes) {
        if (!preReduced) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < -10) node.x = width + 10;
          if (node.x > width + 10) node.x = -10;
          if (node.y < -10) node.y = height + 10;
          if (node.y > height + 10) node.y = -10;
        }

        const pulse = 0.7 + 0.3 * Math.sin(t + node.pulsePhase);
        const r = node.radius * pulse;

        // Subtle glow halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}0.15)`;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}0.85)`;
        ctx.fill();
      }

      if (!preReduced) {
        animId = requestAnimationFrame(render);
      }
    };

    if (preReduced) {
      render();
    } else {
      animId = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener('resize', init);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep Navy/Black Futuristic Radial Background */}
      <div className="absolute inset-0 bg-[#060B18]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(14,165,233,0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(37,99,235,0.12),transparent_50%)]" />

      {/* Cybernetic Geometric Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #38BDF8 1px, transparent 1px),
            linear-gradient(to bottom, #38BDF8 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />

      {/* Futuristic Robotic / Circuit Schematics (Lightweight SVGs in corners) */}
      <svg
        className="absolute top-0 right-0 w-[280px] h-[280px] sm:w-[420px] sm:h-[420px] text-cyan-500/10 pointer-events-none select-none"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="400" cy="0" r="320" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
        <circle cx="400" cy="0" r="240" stroke="currentColor" strokeWidth="1" />
        <circle cx="400" cy="0" r="160" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" />
        <line x1="160" y1="0" x2="160" y2="120" stroke="currentColor" strokeWidth="1" />
        <line x1="160" y1="120" x2="280" y2="240" stroke="currentColor" strokeWidth="1" />
        <circle cx="280" cy="240" r="4" fill="currentColor" />
        <circle cx="160" cy="120" r="3" fill="currentColor" />
        <rect x="260" y="220" width="40" height="40" stroke="currentColor" strokeWidth="0.75" />
      </svg>

      <svg
        className="absolute bottom-0 left-0 w-[240px] h-[240px] sm:w-[360px] sm:h-[360px] text-blue-500/10 pointer-events-none select-none"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="0" cy="400" r="300" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
        <circle cx="0" cy="400" r="200" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="200" x2="150" y2="200" stroke="currentColor" strokeWidth="1" />
        <line x1="150" y1="200" x2="250" y2="300" stroke="currentColor" strokeWidth="1" />
        <circle cx="250" cy="300" r="4" fill="currentColor" />
        <rect x="230" y="280" width="40" height="40" stroke="currentColor" strokeWidth="0.75" />
      </svg>

      {/* Dynamic Neural Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
};
