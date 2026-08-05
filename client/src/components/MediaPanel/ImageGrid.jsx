import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';

const ImageCard = ({ img, onSelect }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `img-${img.id}`,
    data: { ...img, type: 'image' }
  });

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      className="media-image-card"
      onClick={() => onSelect(img)}
      {...attributes}
      {...listeners}
    >
      <img src={img.src} alt={img.alt || img.title} className="media-image-img" loading="lazy" />
      <div className="media-image-hover-title">{img.title}</div>
    </motion.div>
  );
};

export const ImageGrid = ({ images, onSelectImage, maxCount }) => {
  const displayImages = maxCount ? images.slice(0, maxCount) : images;

  if (!displayImages || displayImages.length === 0) {
    return <div className="empty-media-msg">No images available</div>;
  }

  return (
    <div className="media-image-grid">
      {displayImages.map(img => (
        <ImageCard key={img.id} img={img} onSelect={onSelectImage} />
      ))}
    </div>
  );
};
