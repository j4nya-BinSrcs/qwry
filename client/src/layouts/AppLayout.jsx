import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "../components/TopBar";
import SourcesPanel from "../panels/SourcesPanel";
import WorkspacePanel from "../panels/WorkspacePanel";
import DiscoveryPanel from "../panels/DiscoveryPanel";

export default function AppLayout({ toggleTheme, theme }) {
  return (
    <div className="h-full flex flex-col">
      <TopBar toggleTheme={toggleTheme} theme={theme} />
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={22} minSize={15} maxSize={35}>
            <div className="h-full bg-panel backdrop-blur-xl border-r border-border">
              <SourcesPanel />
            </div>
          </Panel>
          <PanelResizeHandle />
          <Panel defaultSize={52} minSize={30}>
            <div className="h-full bg-panel backdrop-blur-xl">
              <WorkspacePanel />
            </div>
          </Panel>
          <PanelResizeHandle />
          <Panel defaultSize={26} minSize={15} maxSize={38}>
            <div className="h-full bg-panel backdrop-blur-xl border-l border-border">
              <DiscoveryPanel />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}