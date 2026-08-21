import React, {
  useEffect,
  useRef,
} from "react";

import Message from "./Message";

function ChatWindow({
  activeChat,
  loading,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    activeChat?.messages,
    loading,
  ]);

  const messages =
    activeChat?.messages || [];

  if (messages.length === 0) {
    return (
      <section className="chat-window">

        <div className="welcome">

          <div className="welcome-logo">
            R
          </div>

          <p className="welcome-small">
            ROYAL INTELLIGENCE
          </p>

          <h1>
            How can I help you?
          </h1>

          <p className="welcome-text">
            Ask questions, learn concepts,
            write code, solve problems and
            explore ideas with Royal AI.
          </p>

          <div className="feature-chips">

            <span>Ask anything</span>

            <span>
              Markdown
            </span>

            <span>
              Code support
            </span>

            <span>
              Chat history
            </span>

          </div>

        </div>

      </section>
    );
  }

  return (
    <section className="chat-window">

      <div className="messages-container">

        {messages.map(
          (message, index) => (

            <Message
              key={
                message.id ||
                `${message.role}-${index}`
              }
              message={message}
            />

          )
        )}

        {loading && (

          <div className="message-row assistant-row">

            <div className="message-avatar assistant-avatar">
              R
            </div>

            <div className="message assistant-message">

              <span className="message-role">
                ROYAL AI
              </span>

              <div className="typing">
                <span />
                <span />
                <span />
              </div>

            </div>

          </div>

        )}

        <div ref={bottomRef} />

      </div>

    </section>
  );
}

export default ChatWindow;