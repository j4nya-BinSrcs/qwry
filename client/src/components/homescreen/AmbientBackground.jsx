import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getPalette, hexToRgba } from '../../utils/backgroundPalettes';

const PARTICLE_COUNT = 80;
const AURORA_COUNT = 3;

function createAuroraGeometry() {
  const geometry = new THREE.PlaneGeometry(2, 2, 64, 64);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    positions.setZ(i, Math.sin(x * 3) * Math.cos(y * 2) * 0.15);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createParticleGeometry(count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const speeds = new Float32Array(count);
  const angles = new Float32Array(count);
  const radii = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.3 + Math.random() * 0.7;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    sizes[i] = 1.5 + Math.random() * 2.5;
    alphas[i] = 0.1 + Math.random() * 0.15;
    speeds[i] = 0.0003 + Math.random() * 0.0008;
    angles[i] = angle;
    radii[i] = radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  return geometry;
}

const particleVertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const auroraVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const auroraFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uTime;
  uniform float uOpacity1;
  uniform float uOpacity2;
  uniform float uOpacity3;
  varying vec2 vUv;
  
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05;
    float n = fbm(uv * 3.0 + vec2(t, t * 0.7));
    float n2 = fbm(uv * 5.0 - vec2(t * 0.8, t * 1.2));
    
    vec3 color = mix(uColor1, uColor2, n);
    color = mix(color, uColor3, n2 * 0.5);
    
    float alpha = mix(uOpacity1, uOpacity2, n);
    alpha = mix(alpha, uOpacity3, n2 * 0.3);
    alpha *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export default function AmbientBackground({ theme, isSearchFocused, pointerPosition, reducedMotion }) {
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const aurorasRef = useRef([]);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const targetPointerRef = useRef({ x: 0, y: 0 });
  const currentPointerRef = useRef({ x: 0, y: 0 });
  const paletteRef = useRef(getPalette(theme));

  useEffect(() => {
    paletteRef.current = getPalette(theme);
  }, [theme]);

  useEffect(() => {
    if (reducedMotion) return;
    
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new THREE.WebGLRenderer({
      canvas: document.createElement('canvas'),
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.z = 10;
    cameraRef.current = camera;

    const particleGeo = createParticleGeometry(PARTICLE_COUNT);
    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(paletteRef.current.particles.color) },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uFocusIntensity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    const auroraGeo = createAuroraGeometry();
    for (let i = 0; i < AURORA_COUNT; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        uniforms: {
          uColor1: { value: new THREE.Color(paletteRef.current.auroras[0].color) },
          uColor2: { value: new THREE.Color(paletteRef.current.auroras[1].color) },
          uColor3: { value: new THREE.Color(paletteRef.current.auroras[2].color) },
          uOpacity1: { value: paletteRef.current.auroras[0].opacity },
          uOpacity2: { value: paletteRef.current.auroras[1].opacity },
          uOpacity3: { value: paletteRef.current.auroras[2].opacity },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(auroraGeo, mat);
      mesh.position.z = -1 - i * 0.5;
      mesh.scale.setScalar(1.5 + i * 0.2);
      scene.add(mesh);
      aurorasRef.current.push(mesh);
    }

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.left = -w / h;
      camera.right = w / h;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    const animate = (time) => {
      timeRef.current = time * 0.001;
      
      currentPointerRef.current.x += (targetPointerRef.current.x - currentPointerRef.current.x) * 0.05;
      currentPointerRef.current.y += (targetPointerRef.current.y - currentPointerRef.current.y) * 0.05;

      if (particlesRef.current) {
        particlesRef.current.material.uniforms.uTime.value = timeRef.current;
        particlesRef.current.material.uniforms.uPointer.value.set(
          currentPointerRef.current.x,
          currentPointerRef.current.y
        );
        particlesRef.current.material.uniforms.uFocusIntensity.value = isSearchFocused ? 1 : 0;
        
        const positions = particlesRef.current.geometry.attributes.position;
        const speeds = particlesRef.current.geometry.attributes.aSpeed;
        const angles = particlesRef.current.geometry.attributes.aAngle;
        const radii = particlesRef.current.geometry.attributes.aRadius;
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          let angle = angles.getX(i) + speeds.getX(i) * (time * 0.5);
          let radius = radii.getX(i);
          
          const dx = currentPointerRef.current.x - positions.getX(i);
          const dy = currentPointerRef.current.y - positions.getY(i);
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 0.4 && dist > 0.01) {
            const force = (1 - dist / 0.4) * 0.008;
            angle += Math.atan2(dy, dx) * force;
            radius += force * 0.5;
          }
          
          positions.setX(i, Math.cos(angle) * radius);
          positions.setY(i, Math.sin(angle) * radius);
          angles.setX(i, angle);
        }
        positions.needsUpdate = true;
      }

      aurorasRef.current.forEach((mesh, i) => {
        mesh.material.uniforms.uTime.value = timeRef.current;
        mesh.rotation.z = Math.sin(timeRef.current * 0.1 + i) * 0.02;
      });

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    setInitialized(true);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      particleGeo.dispose();
      particleMaterial.dispose();
      auroraGeo.dispose();
      aurorasRef.current.forEach(m => m.material.dispose());
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [theme, isSearchFocused, reducedMotion]);

  useEffect(() => {
    if (!pointerPosition) return;
    targetPointerRef.current.x = (pointerPosition.x - 0.5) * 2;
    targetPointerRef.current.y = -(pointerPosition.y - 0.5) * 2;
  }, [pointerPosition]);

  if (!initialized) {
    return (
      <div
        ref={containerRef}
        className="ambient-bg-placeholder"
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${paletteRef.current.base[0]}, ${paletteRef.current.base[1]})`,
        }}
      />
    );
  }

  return <div ref={containerRef} className="ambient-bg-canvas" style={{ position: 'absolute', inset: 0 }} />;
}