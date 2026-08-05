import { Fragment } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "../components/TopBar";
import HomeView from "../context/HomeView";
import SourcesPanel from "../panels/SourcesPanel";
import ContextPanel from "../panels/ContextPanel";
import DiscoveryPanel from "../panels/DiscoveryPanel";
import CreateWorkspaceModal from "../components/CreateWorkspaceModal";
import { useUIStore } from "../stores/uiStore";

const PANEL_DEFAULTS = { sources: 30, context: 40, discovery: 30 };
const PANEL_MINS = { sources: 12, context: 20, discovery: 12 };
const PANEL_MAXS = { sources: 40, context: 70, discovery: 40 };

function PanelContent({ id }) {
  switch (id) {
    case "sources":
      return (
        <div className="h-full bg-surface/60 backdrop-blur-md transition-colors">
          <SourcesPanel />
        </div>
      );
    case "context":
      return (
        <div className="h-full bg-surface/60 backdrop-blur-md transition-colors">
          <ContextPanel />
        </div>
      );
    case "discovery":
      return (
        <div className="h-full bg-surface/60 backdrop-blur-md border-l border-border transition-colors">
          <DiscoveryPanel />
        </div>
      );
    default:
      return null;
  }
}

export default function AppLayout() {
  const contextMode = useUIStore((s) => s.contextMode);
  const panelOrder = useUIStore((s) => s.panelOrder);
  const expandedPanel = useUIStore((s) => s.expandedPanel);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-surface text-text">
      {/* Background Ambient Glow Orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-violet-600/10 blur-[100px] animate-aurora-1" />
      <div className="pointer-events-none absolute top-1/2 -right-32 size-96 rounded-full bg-cyan-500/10 blur-[100px] animate-aurora-2" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-pink-500/10 blur-[90px] animate-aurora-1" />

      {contextMode !== "home" && <TopBar />}
      
      <div className="relative z-10 flex-1 min-h-0">
        {contextMode === "home" ? (
          <HomeView />
        ) : expandedPanel ? (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={100} minSize={100}>
              <PanelContent id={expandedPanel} />
            </Panel>
          </PanelGroup>
        ) : (
          <PanelGroup direction="horizontal">
            {panelOrder.map((id, index) => (
              <Fragment key={id}>
                {index > 0 && <PanelResizeHandle />}
                <Panel
                  defaultSize={PANEL_DEFAULTS[id]}
                  minSize={PANEL_MINS[id]}
                  maxSize={PANEL_MAXS[id]}
                >
                  <PanelContent id={id} />
                </Panel>
              </Fragment>
            ))}
          </PanelGroup>
        )}
      </div>

      {/* Global Create Workspace Modal */}
      <CreateWorkspaceModal />
    </div>
  );
}


