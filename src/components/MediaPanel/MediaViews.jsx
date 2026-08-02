import React from 'react';
import { Play } from 'lucide-react';

export const VideoList = ({ videos, maxCount }) => {
  const displayVideos = maxCount ? videos.slice(0, maxCount) : videos;

  if (!displayVideos || displayVideos.length === 0) {
    return <div className="empty-media-msg">No videos available</div>;
  }

  return (
    <div className="media-video-list">
      {displayVideos.map(vid => (
        <div
          key={vid.id}
          className="media-video-card"
          onClick={() => window.open(vid.url, '_blank')}
        >
          <div className="media-video-thumbnail" style={{ backgroundImage: `url(${vid.thumbnail})` }}>
            <div className="video-play-overlay">
              <Play size={18} fill="#fff" color="#fff" />
            </div>
            <span className="video-duration">{vid.duration}</span>
          </div>
          <div className="video-card-info">
            <h4 className="video-card-title">{vid.title}</h4>
            <span className="video-card-source">{vid.source}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export const NewsList = ({ articles }) => {
  if (!articles || articles.length === 0) {
    return <div className="empty-media-msg">No news available</div>;
  }

  return (
    <div className="media-news-list">
      {articles.map(art => (
        <div
          key={art.id}
          className="media-news-card"
          onClick={() => window.open(art.url, '_blank')}
        >
          <img src={art.image} alt="" className="news-card-img" />
          <div className="news-card-info">
            <span className="news-card-source">{art.source} • {art.publishedAt}</span>
            <h4 className="news-card-title">{art.title}</h4>
          </div>
        </div>
      ))}
    </div>
  );
};
