import fallbackResults from '../data/fallback-results.json';
import fallbackImages from '../data/fallback-images.json';
import fallbackAi from '../data/fallback-ai.json';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const fetchJson = async (url, fallbackData) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Qwry API] Failed to reach endpoint ${url}. Using fallback data.`, err);
    return fallbackData;
  }
};

const postJson = async (url, body, fallbackData) => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Qwry API] Failed to post to ${url}. Using fallback data.`, err);
    return fallbackData;
  }
};

export const searchApi = {
  search: async (query, page = 1) => {
    const data = await fetchJson(`${API_BASE}/search?q=${encodeURIComponent(query)}&page=${page}`, {
      results: fallbackResults,
      totalCount: fallbackResults.length,
      queryTime: '0.18s'
    });
    return data;
  },

  suggest: async (query) => {
    const data = await fetchJson(`${API_BASE}/suggest?q=${encodeURIComponent(query)}`, {
      suggestions: [
        { text: 'web design trends 2026', type: 'trending' },
        { text: 'react documentation', type: 'suggested' },
        { text: 'glassmorphism css guide', type: 'suggested' },
        { text: 'framer motion drag tutorial', type: 'trending' }
      ]
    });
    return data;
  },

  images: async (query) => {
    const data = await fetchJson(`${API_BASE}/images?q=${encodeURIComponent(query)}`, {
      images: fallbackImages,
      total: fallbackImages.length
    });
    return data;
  },

  videos: async (query) => {
    const data = await fetchJson(`${API_BASE}/videos?q=${encodeURIComponent(query)}`, {
      videos: [
        {
          id: 'v1',
          thumbnail: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=600&q=80',
          title: 'Building 60FPS Glassmorphism UI Components in React',
          source: 'YouTube — Web Dev Simplified',
          duration: '14:20',
          url: 'https://youtube.com/watch?v=mock1'
        },
        {
          id: 'v2',
          thumbnail: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
          title: 'Framer Motion Masterclass: Layout Animations',
          source: 'Vimeo — UI Motion Studio',
          duration: '28:45',
          url: 'https://vimeo.com/mock2'
        }
      ]
    });
    return data;
  },

  news: async (query) => {
    const data = await fetchJson(`${API_BASE}/news?q=${encodeURIComponent(query)}`, {
      articles: [
        {
          id: 'n1',
          title: 'Vite 6 Released: Unlocking Next-Level Build Performance',
          source: 'Frontend Weekly',
          image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80',
          url: 'https://example.com/news1',
          publishedAt: '2 hours ago'
        }
      ]
    });
    return data;
  },

  aiOverview: async (query) => {
    const data = await fetchJson(`${API_BASE}/ai/overview?q=${encodeURIComponent(query)}`, fallbackAi);
    return data;
  },

  aiChat: async (message, context = []) => {
    const data = await postJson(`${API_BASE}/ai/chat`, { message, context }, {
      response: `[Offline Mode] Qwry AI received your follow-up: "${message}". Combining context from ${context.length} item(s), here is an AI synthesis of web design best practices.`
    });
    return data;
  }
};
