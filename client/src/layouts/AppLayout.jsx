import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "../components/TopBar";
import SourcesPanel from "../panels/SourcesPanel";
import WorkspacePanel from "../panels/WorkspacePanel";
import DiscoveryPanel from "../panels/DiscoveryPanel";

export default function AppLayout() {
  return (
    <div className="h-full flex flex-col bg-surface">
      <TopBar />
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={22} minSize={15} maxSize={35}>
            <SourcesPanel />
          </Panel>
          <PanelResizeHandle />
          <Panel defaultSize={52} minSize={30}>
            <WorkspacePanel />
          </Panel>
          <PanelResizeHandle />
          <Panel defaultSize={26} minSize={15} maxSize={38}>
            <DiscoveryPanel />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}