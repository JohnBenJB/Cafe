import React from "react";
import "./index.scss";

function Chat() {
  return (
    <div className="cafe-chat-container">
      <header className="cafe-chat-header">
        <div className="logo">
          <div className="coffee-icon">
            <img src="public/cafe.png" width="80" alt="Cafe" />
          </div>
          <span className="logo-text">Café</span>
        </div>
      </header>
      <div className="cafe-chat-messages">
        <div className="cafe-chat-message cafe-chat-message-user">
          <div className="cafe-chat-bubble">Hi there! 👋</div>
          <div className="cafe-chat-meta">You</div>
        </div>
        <div className="cafe-chat-message cafe-chat-message-ai">
          <div className="cafe-chat-bubble">
            Welcome to Cafe! How can I help you today?
          </div>
          <div className="cafe-chat-meta">Cafe AI</div>
        </div>
        <div className="cafe-chat-message cafe-chat-message-user">
          <div className="cafe-chat-bubble">Show me my recent commits.</div>
          <div className="cafe-chat-meta">You</div>
        </div>
        <div className="cafe-chat-message cafe-chat-message-ai">
          <div className="cafe-chat-bubble">
            Here are your latest commits: [static example]
          </div>
          <div className="cafe-chat-meta">Cafe AI</div>
        </div>
      </div>
      <form className="cafe-chat-input-area">
        <input
          type="text"
          className="cafe-chat-input"
          placeholder="Type your message..."
          disabled
        />
        <button type="submit" className="cafe-chat-send-btn" disabled>
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;
