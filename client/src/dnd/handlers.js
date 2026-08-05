export function handleDragEnd(event, sessionId, addItem) {
  const { active, over } = event;
  if (!over) return;

  const isOverWorkspace =
    over.id === "workspace-drop" || over.data?.current?.type === "workspace";
  if (!isOverWorkspace) return;

  const sourceData = active.data?.current;
  if (sourceData?.type !== "search-result") return;

  const result = sourceData.result;
  if (!result) return;

  addItem(sessionId, over.id, result.url, result.title, result.snippet, result.source);
}