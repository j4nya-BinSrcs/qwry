import { Fragment } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "../components/TopBar";
import HomeView from "../context/HomeView";
import SourcesPanel from "../panels/SourcesPanel";
import ContextPanel from "../panels/ContextPanel";
import DiscoveryPanel from "../panels/DiscoveryPanel";
import { useUIStore } from "../stores/uiStore";

const PANEL_DEFAULTS = { sources: 26, context: 42, discovery: 32 };
const PANEL_MINS = { sources: 10, context: 20, discovery: 10 };
const PANEL_MAXS = { sources: 36, context: 70, discovery: 40 };

function PanelContent({ id }) {
  switch (id) {
    case "sources":
      return (
        <div className="h-full bg-surface">
          <SourcesPanel />
        </div>
      );
    case "context":
      return (
        <div className="h-full bg-surface">
          <ContextPanel />
        </div>
      );
    case "discovery":
      return (
        <div className="h-full bg-surface">
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
    <div className="h-full flex flex-col">
      {contextMode !== "home" && <TopBar />}
      <div className="flex-1 min-h-0 relative">
        <div className={contextMode === "home" ? "hidden" : "contents"}>
          {expandedPanel ? (
            <PanelGroup direction="horizontal">
              <Panel defaultSize={100} minSize={100}>
                <PanelContent id={expandedPanel} />
              </Panel>
            </PanelGroup>
          ) : (
            <PanelGroup direction="horizontal">
              {panelOrder.map((id, index) => (
                <Fragment key={id}>
                  {index > 0 && (
                    <PanelResizeHandle className="group relative w-1 bg-transparent shrink-0">
                      <div className="absolute inset-y-0 left-0 w-px bg-border/25 group-hover:bg-accent/60 transition-colors duration-fast" />
                    </PanelResizeHandle>
                  )}
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
        {contextMode === "home" && <HomeView />}
      </div>
    </div>
  );
}
