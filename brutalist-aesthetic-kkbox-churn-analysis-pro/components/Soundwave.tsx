import React, { useRef, useEffect, useState } from 'react';

interface SoundwaveProps {
  numBars?: number;
  barWidth?: number;
  gap?: number;
  maxHeight?: number;
  color?: string;
  className?: string;
}

const Soundwave: React.FC<SoundwaveProps> = ({
  numBars = 64,
  barWidth = 3,
  gap = 2,
  maxHeight = 60,
  color = '#ff4d00',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const [mouseX, setMouseX] = useState(0.5);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const phasesRef = useRef<number[]>([]);
  const speedsRef = useRef<number[]>([]);

  // Initialize random phases and speeds for each bar
  useEffect(() => {
    phasesRef.current = Array.from({ length: numBars }, () => Math.random() * Math.PI * 2);
    speedsRef.current = Array.from({ length: numBars }, () => 0.5 + Math.random() * 2);
  }, [numBars]);

  useEffect(() => {
    const animate = () => {
      timeRef.current += 0.03;

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;

        const normalizedX = i / numBars;
        const phase = phasesRef.current[i] || 0;
        const speed = speedsRef.current[i] || 1;

        // Distance from mouse affects amplitude
        const distanceFromMouse = Math.abs(normalizedX - mouseX);
        const mouseInfluence = isHovered ? Math.max(0, 1 - distanceFromMouse * 2.5) : 0;

        // Base animation - multiple frequencies for organic feel
        const wave1 = Math.sin(timeRef.current * speed + phase);
        const wave2 = Math.sin(timeRef.current * speed * 1.5 + phase * 0.7) * 0.5;
        const wave3 = Math.sin(timeRef.current * speed * 0.5 + phase * 1.3) * 0.3;

        // Combine waves and add mouse influence
        const baseHeight = 0.15 + (wave1 + wave2 + wave3 + 1.8) / 3.6 * 0.5;
        const heightMultiplier = baseHeight + mouseInfluence * 0.5;
        const barHeight = Math.max(4, heightMultiplier * maxHeight);

        bar.style.height = `${barHeight}px`;

        // Glow effect on hover near mouse
        if (isHovered && mouseInfluence > 0.3) {
          bar.style.boxShadow = `0 0 ${8 * mouseInfluence}px rgba(255, 77, 0, ${0.6 * mouseInfluence})`;
        } else {
          bar.style.boxShadow = 'none';
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [numBars, maxHeight, mouseX, isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      setMouseX(Math.max(0, Math.min(1, x)));
    }
  };

  const totalWidth = numBars * (barWidth + gap) - gap;

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center cursor-crosshair ${className}`}
      style={{ height: maxHeight + 20 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMouseX(0.5);
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          gap: `${gap}px`,
          width: totalWidth,
        }}
      >
        {Array.from({ length: numBars }).map((_, i) => (
          <div
            key={i}
            ref={(el) => { if (el) barsRef.current[i] = el; }}
            style={{
              width: barWidth,
              height: 4,
              backgroundColor: color,
              borderRadius: barWidth / 2,
              transition: 'box-shadow 0.15s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Soundwave;
