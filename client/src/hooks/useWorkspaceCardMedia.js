import { useMemo } from 'react';

export function useWorkspaceCardMedia(items, maxItems = 6) {
  return useMemo(() => {
    if (!items?.length) return [];

    const mediaItems = items
      .filter((item) => item.media_url || item.thumbnail || item.img_src)
      .slice(0, maxItems)
      .map((item) => ({
        src: item.media_url || item.thumbnail || item.img_src,
        alt: item.title || '',
        url: item.url,
        title: item.title,
      }));

    return mediaItems;
  }, [items, maxItems]);
}

export function useDomainPills(items, maxDomains = 4) {
  return useMemo(() => {
    if (!items?.length) return { domains: [], overflow: 0 };

    const seen = new Set();
    const domains = [];

    for (const item of items) {
      try {
        const d = new URL(item.url).hostname.replace(/^www\./, '');
        if (!seen.has(d)) {
          seen.add(d);
          domains.push(d);
        }
      } catch {}
    }

    return {
      domains: domains.slice(0, maxDomains),
      overflow: Math.max(0, domains.length - maxDomains),
    };
  }, [items, maxDomains]);
}

export function useWorkspaceStats(workspaceId, stationStore) {
  return useMemo(() => {
    if (!workspaceId || !stationStore) return { notes: 0, comparisons: 0 };

    const notes = stationStore.notes?.filter(n => n.workspace_id === workspaceId).length ?? 0;
    const comparisons = stationStore.comparisons?.filter(c => c.workspace_id === workspaceId).length ?? 0;

    return { notes, comparisons };
  }, [workspaceId, stationStore]);
}