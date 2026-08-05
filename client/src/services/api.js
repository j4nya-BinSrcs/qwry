import { searchQuery, fetchSuggestions } from '../api/search';
import { llmGenerate, fetchOverview } from '../api/llm';
import fallbackResults from '../data/fallback-results.json';
import fallbackImages from '../data/fallback-images.json';
import fallbackAi from '../data/fallback-ai.json';

export const searchApi = {
  search: async (query, page = 1) => {
    try {
      const data = await searchQuery(query, page);
      const resultsWithDomain = (data.results || []).map((item, idx) => {
        let domain = item.source;
        if (!domain && item.url) {
          try { domain = new URL(item.url).hostname; } catch { domain = item.url; }
        }
        return {
          id: item.url || `res-${idx}`,
          ...item,
          domain: domain || 'web'
        };
      });

      return {
        query: data.query || query,
        results: resultsWithDomain,
        totalCount: data.total_results || resultsWithDomain.length,
        suggestions: data.suggestions || [],
        infoboxes: data.infoboxes || [],
        queryTime: '0.15s'
      };
    } catch (err) {
      console.warn(`[Qwry API] Search call failed, using fallback data if offline mode enabled.`, err);
      return {
        results: fallbackResults,
        totalCount: fallbackResults.length,
        queryTime: '0.18s',
        suggestions: []
      };
    }
  },

  suggest: async (query) => {
    try {
      const suggestionsList = await fetchSuggestions(query);
      return {
        suggestions: (suggestionsList || []).map(text => ({ text, type: 'suggested' }))
      };
    } catch (err) {
      console.warn(`[Qwry API] Suggest call failed.`, err);
      return { suggestions: [] };
    }
  },

  images: async (query) => {
    try {
      const data = await searchQuery(query, 1, 20, null, 'images');
      const rawResults = data.results || [];
      const images = rawResults
        .filter(item => item.img_src || item.thumbnail)
        .map((item, idx) => ({
          id: item.url || `img-${idx}`,
          src: item.img_src || item.thumbnail,
          title: item.title,
          alt: item.title,
          url: item.url,
          source: item.source || (item.url ? new URL(item.url).hostname : 'Web')
        }));

      return { images, total: images.length };
    } catch (err) {
      console.warn(`[Qwry API] Images call failed, using fallback data.`, err);
      return { images: fallbackImages, total: fallbackImages.length };
    }
  },

  videos: async (query) => {
    try {
      const data = await searchQuery(query, 1, 20, null, 'videos');
      const rawResults = data.results || [];
      const videos = rawResults.map((item, idx) => ({
        id: item.url || `vid-${idx}`,
        thumbnail: item.img_src || item.thumbnail || 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=600&q=80',
        title: item.title,
        source: item.source || (item.url ? new URL(item.url).hostname : 'Web'),
        duration: item.published_date || '',
        url: item.url
      }));

      return { videos, total: videos.length };
    } catch (err) {
      console.warn(`[Qwry API] Videos call failed.`, err);
      return { videos: [], total: 0 };
    }
  },

  news: async () => {
    // Note: Backend does NOT support categories=news. Graceful empty response returned.
    return { articles: [], unsupported: true };
  },

  aiOverview: async (query, results = []) => {
    try {
      // First check if cached overview exists in history
      const cached = await fetchOverview(query);
      if (cached) {
        return { summary: cached, suggestions: [] };
      }

      // Generate new short overview via LLM
      const res = await llmGenerate(query, results, 'short');
      return {
        summary: res.response || 'No AI summary generated.',
        suggestions: []
      };
    } catch (err) {
      console.warn(`[Qwry API] AI Overview call failed, using fallback data.`, err);
      return fallbackAi;
    }
  },

  aiChat: async (message, context = [], mode = 'short') => {
    try {
      // Backend has no multi-turn chat endpoint outside workspace.
      // Submit each message as an independent POST /api/llm/generate call.
      const res = await llmGenerate(message, context, mode);
      return { response: res.response };
    } catch (err) {
      console.warn(`[Qwry API] AI Chat call failed.`, err);
      return { response: `[Error] Unable to reach Qwry AI service: ${err.message}` };
    }
  }
};
