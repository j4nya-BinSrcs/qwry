import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const ChatMessage = ({ message }) => {
  const { sender, text } = message;
  const isAi = sender === 'ai';

  const [displayedText, setDisplayedText] = useState(isAi ? '' : text);
  const [isTyping, setIsTyping] = useState(isAi);

  useEffect(() => {
    if (!isAi) return;
    let index = 0;
    setDisplayedText('');
    setIsTyping(true);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => prev + text.charAt(index));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 15);

    return () => clearInterval(timer);
  }, [text, isAi]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isAi ? -10 : 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`chat-message-bubble ${isAi ? 'chat-message-ai' : 'chat-message-user'}`}
    >
      <div className="chat-message-text">
        {displayedText}
        {isTyping && <span className="typewriter-cursor" />}
      </div>
    </motion.div>
  );
};
