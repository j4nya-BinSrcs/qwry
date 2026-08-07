import { useEffect, useRef, useState } from 'react';
import { getAccentColor, useUIStore } from '../../stores/uiStore';

const SHAPES = ['circle', 'square', 'hexagon'];
const SHAPE_DURATION = 3000;

function Shape({ type, size, color, className }) {
  const styles = {
    width: size,
    height: size,
    backgroundColor: color,
    transition: 'border-radius 400ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  switch (type) {
    case 'circle':
      styles.borderRadius = '50%';
      break;
    case 'square':
      styles.borderRadius = '20%';
      break;
    case 'hexagon':
      styles.clipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
      break;
    default:
      styles.borderRadius = '24px';
  }

  return <div className={className} style={styles} aria-hidden="true" />;
}

export function LogoMark({ size = 48, animated = true, className = '' }) {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [color, setColor] = useState(() => getAccentColor());
  const theme = useUIStore((s) => s.theme);
  const cycleRef = useRef(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
    const handler = (e) => { prefersReducedMotion.current = e.matches; };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setColor(getAccentColor());
  }, [theme]);

  useEffect(() => {
    if (!animated || prefersReducedMotion.current) return;
    cycleRef.current = setInterval(() => {
      setShapeIndex((prev) => (prev + 1) % SHAPES.length);
    }, SHAPE_DURATION);
    return () => clearInterval(cycleRef.current);
  }, [animated]);

  return (
    <div
      className={`logo-mark ${className}`}
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      aria-hidden="true"
    >
      <Shape type={SHAPES[shapeIndex]} size={size} color={color} />
    </div>
  );
}

export function LogoWordmark({ size = 28, className = '' }) {
  return (
    <span
      className={`logo-wordmark ${className}`}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: size,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: 'var(--color-text)',
      }}
    >
      QWRY
    </span>
  );
}

export function LogoLockup({ markSize = 40, wordmarkSize = 24, gap = 12, animated = true, className = '' }) {
  return (
    <div className={`logo-lockup ${className}`} style={{ display: 'flex', alignItems: 'center', gap }}>
      <LogoMark size={markSize} animated={animated} />
      <LogoWordmark size={wordmarkSize} />
    </div>
  );
}

export default function Logo({ variant = 'lockup', ...props }) {
  switch (variant) {
    case 'mark':
      return <LogoMark {...props} />;
    case 'wordmark':
      return <LogoWordmark {...props} />;
    case 'lockup':
    default:
      return <LogoLockup {...props} />;
  }
}