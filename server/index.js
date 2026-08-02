import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper to load json file
const loadData = (filename) => {
  const filePath = path.join(__dirname, 'data', filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
};

// Simulate realistic network delay (150-350ms)
app.use((req, res, next) => {
  const delay = Math.floor(Math.random() * 200) + 150;
  setTimeout(next, delay);
});

// GET /api/search?q={query}
app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const allResults = loadData('results.json');
  
  let filtered = allResults;
  if (query) {
    filtered = allResults.filter(
      r => r.title.toLowerCase().includes(query) || 
           r.snippet.toLowerCase().includes(query) ||
           r.domain.toLowerCase().includes(query)
    );
    // If no match found, fallback to return results for demonstration
    if (filtered.length === 0) {
      filtered = allResults;
    }
  }
  
  res.json({
    results: filtered,
    totalCount: filtered.length,
    queryTime: `${(Math.random() * 0.2 + 0.15).toFixed(2)}s`
  });
});

// GET /api/suggest?q={partial}
app.get('/api/suggest', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const allSuggestions = loadData('suggestions.json');
  
  let filtered = allSuggestions;
  if (query) {
    filtered = allSuggestions.filter(s => s.text.toLowerCase().includes(query));
  }
  
  res.json({ suggestions: filtered.slice(0, 8) });
});

// GET /api/images?q={query}
app.get('/api/images', (req, res) => {
  const images = loadData('images.json');
  res.json({ images, total: images.length });
});

// GET /api/videos?q={query}
app.get('/api/videos', (req, res) => {
  const videos = loadData('videos.json');
  res.json({ videos });
});

// GET /api/news?q={query}
app.get('/api/news', (req, res) => {
  const news = loadData('news.json');
  res.json({ articles: news });
});

// GET /api/ai/overview?q={query}
app.get('/api/ai/overview', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const aiData = loadData('ai-responses.json');
  
  let responseData = aiData['default'];
  if (query.includes('web') || query.includes('design') || query.includes('css')) {
    responseData = aiData['web design'];
  } else if (query.includes('react') || query.includes('hook') || query.includes('code')) {
    responseData = aiData['react'];
  }
  
  res.json(responseData);
});

// POST /api/ai/chat
app.post('/api/ai/chat', (req, res) => {
  const { message, context } = req.body;
  
  let reply = `I've analyzed your question "${message}". `;
  if (context && context.length > 0) {
    const titles = context.map(c => c.title || c.alt || 'item').join(', ');
    reply += `Using the context from [${titles}], here are the key insights: Glassmorphic surfaces work best with subtle border highlights and background contrast!`;
  } else {
    reply += `Qwry AI recommends utilizing CSS design tokens and smooth spring transitions for optimal performance across all viewports.`;
  }
  
  res.json({ response: reply });
});

app.listen(PORT, () => {
  console.log(`Qwry Express Mock Server running at http://localhost:${PORT}`);
});
