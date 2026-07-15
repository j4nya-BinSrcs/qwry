import { Fragment } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "../components/TopBar";
import SourcesPanel from "../panels/SourcesPanel";
import ContextPanel from "../panels/ContextPanel";
import DiscoveryPanel from "../panels/DiscoveryPanel";
import FilterSidebar from "../panels/FilterSidebar";
import { useUIStore } from "../stores/uiStore";

const PANEL_DEFAULTS = { sources: 22, context: 52, discovery: 26 };
const PANEL_MINS = { sources: 12, context: 20, discovery: 12 };
const PANEL_MAXS = { sources: 40, context: 70, discovery: 40 };

function renderPanel(id) {
  switch (id) {
    case "sources":
      return (
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={18} minSize={14} maxSize={26}>
            <div className="h-full bg-white border-r border-border">
              <FilterSidebar />
            </div>
          </Panel>
          <PanelResizeHandle />
          <Panel defaultSize={82} minSize={74}>
            <div className="h-full bg-white">
              <SourcesPanel />
            </div>
          </Panel>
        </PanelGroup>
      );
    case "context":
      return (
        <div className="h-full bg-white">
          <ContextPanel />
        </div>
      );
    case "discovery":
      return (
        <div className="h-full bg-white border-l border-border">
          <DiscoveryPanel />
        </div>
      );
  }
}

export default function AppLayout() {
  const panelOrder = useUIStore((s) => s.panelOrder);
  const expandedPanel = useUIStore((s) => s.expandedPanel);

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 min-h-0">
        {expandedPanel ? (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={100} minSize={100}>
              {renderPanel(expandedPanel)}
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
                  {renderPanel(id)}
                </Panel>
              </Fragment>
            ))}
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
