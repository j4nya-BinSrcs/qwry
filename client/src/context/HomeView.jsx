import { useCallback, useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useUIStore, applyThemeClass, getAccentColor } from "../stores/uiStore";
import {
  Logo,
  SearchBar,
  WebThreads,
  MagicBento,
  BentoReadsCard,
  BentoSummariesCard,
  BentoWorkspacesCard,
  BentoSettingsCard,
} from "../components/homescreen";
import { getPalette, hexToRgbString } from "../utils/backgroundPalettes";

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function HomeView() {
  const sessionId = useSessionStore((s) => s.sessionId);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const wsLoading = useWorkspaceStore((s) => s.loading);
  const itemsByWorkspace = useWorkspaceStore((s) => s.itemsByWorkspace);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const loadAllItems = useWorkspaceStore((s) => s.loadAllItems);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);

  const setContextMode = useUIStore((s) => s.setContextMode);
  const theme = useUIStore((s) => s.theme);

  const [quickQuery, setQuickQuery] = useState("");
  const [accentColor, setAccentColor] = useState(() => getAccentColor());
  const [webgl] = useState(() => supportsWebGL());
  const [reducedMotion] = useState(() => prefersReducedMotion());

  useEffect(() => {
    applyThemeClass(theme);
    setAccentColor(getAccentColor());
  }, [theme]);

  useEffect(() => {
    loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0) {
      loadAllItems(sessionId, workspaces);
    }
  }, [sessionId, workspaces, loadAllItems]);

  const palette = getPalette(theme);
  const glowRgb = hexToRgbString(accentColor);

  const handleCreateWs = useCallback(
    async (name) => {
      if (name) await createWorkspace(sessionId, name);
    },
    [sessionId, createWorkspace]
  );

  const handleOpenWorkspace = useCallback(
    (wsId) => {
      setActive(wsId);
      setContextMode("workspace");
    },
    [setActive, setContextMode]
  );

  return (
    <div className="home-scale h-full overflow-hidden relative flex flex-col">
      {/* Animated thread background */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {webgl && !reducedMotion ? (
          <WebThreads
            color1={accentColor}
            color2="#000000"
            color3="#000000"
            speed={0.35}
            threadCount={10}
            frequency={12}
            spread={0.05}
            taper={0.7}
            position={0.5}
            fanMode="right"
            glow={0.008}
            falloff={0.8}
            thickness={0.65}
            brightness={1.2}
            opacity={0.4}
            mirror
            shimmer={false}
            grain={false}
            grainIntensity={0.05}
            mouseInteraction
            mouseStrength={1}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${
                palette.base[1] || palette.base[0]
              }, ${palette.base[0]})`,
            }}
          />
        )}
      </div>

      {/* Content — compact, vertically centered, no scroll */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center pointer-events-none">
        {/* Hero */}
        <div className="shrink-0 px-6 pt-1 pb-1 pointer-events-auto">
          <div className="mx-auto w-full max-w-lg text-center">
            <div className="flex justify-center mb-1">
              <Logo variant="lockup" markSize={44} wordmarkSize={25} />
            </div>
            <p className="text-sm text-muted mb-2">
              Search, save, summarize, and organize your research.
            </p>
            <SearchBar value={quickQuery} onChange={setQuickQuery} />
          </div>
        </div>

        {/* Bento grid — 60% width, 10% margin below search, centered, no scroll */}
        <div className="shrink-0 w-[60%] mx-auto mt-[10vh] pb-1 overflow-hidden pointer-events-auto">
          <MagicBento
            glowColor={glowRgb}
            spotlightRadius={260}
            particleCount={10}
            enableStars={!reducedMotion}
            enableSpotlight={!reducedMotion}
            enableBorderGlow
            enableTilt={!reducedMotion}
            enableMagnetism={!reducedMotion}
            clickEffect={!reducedMotion}
            disableAnimations={reducedMotion}
          >
            <BentoReadsCard />
            <BentoSummariesCard />
            <BentoWorkspacesCard
              workspaces={workspaces}
              itemsByWorkspace={itemsByWorkspace}
              loading={wsLoading}
              onCreate={handleCreateWs}
              onOpen={handleOpenWorkspace}
            />
            <BentoSettingsCard data-magic-static />
          </MagicBento>
        </div>
      </div>
    </div>
  );
}
