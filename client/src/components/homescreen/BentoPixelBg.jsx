import PixelBlast from '../PixelBlast';
import { getAccentColor, useUIStore } from '../../stores/uiStore';

export default function BentoPixelBg({
  pixelSize = 2.5,
  patternScale = 3,
  speed = 0.4,
  opacity = 0.35,
  className = '',
}) {
  const color = useUIStore((s) => getAccentColor());

  return (
    <div className={`bento-pixel ${className}`} aria-hidden="true" style={{ opacity }}>
      <PixelBlast
        pixelSize={pixelSize}
        color={color}
        patternScale={patternScale}
        patternDensity={1}
        pixelSizeJitter={0.4}
        enableRipples
        rippleSpeed={0.35}
        rippleThickness={0.1}
        rippleIntensityScale={1.2}
        speed={speed}
        edgeFade={0.25}
        transparent
        autoPauseOffscreen
      />
    </div>
  );
}
