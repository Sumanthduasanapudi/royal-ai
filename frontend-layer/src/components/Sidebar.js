import React from "react";

function Sidebar({
  chats,
  activeChatId,
  selectChat,
  createNewChat,
  deleteChat,
  sidebarOpen,
  closeSidebar,
}) {
  return (
    <aside
      className={
        sidebarOpen
          ? "sidebar sidebar-open"
          : "sidebar"
      }
    >

      <div className="sidebar-header">

        <div className="brand">

          <div className="brand-logo">
            R
          </div>

          <div>
            <h2>Royal AI</h2>
            <p>Intelligent Assistant</p>
          </div>

        </div>

        <button
          className="mobile-close-button"
          onClick={closeSidebar}
          aria-label="Close menu"
        >
          ×
        </button>

      </div>

      <button
        className="new-chat-button"
        onClick={createNewChat}
      >
        + New Chat
      </button>

      <div className="history-title">
        RECENT CHATS
      </div>

      <div className="chat-history">

        {chats.map((chat) => (

          <div
            className={
              chat.id === activeChatId
                ? "history-item active"
                : "history-item"
            }
            key={chat.id}
          >

            <button
              className="history-select"
              onClick={() =>
                selectChat(chat.id)
              }
            >
              <span className="chat-icon">
                ◇
              </span>

              <span className="chat-title">
                {chat.title}
              </span>
            </button>

            <button
              className="delete-chat"
              onClick={() =>
                deleteChat(chat.id)
              }
              aria-label="Delete chat"
              title="Delete chat"
            >
              ×
            </button>

          </div>

        ))}

      </div>

      <div className="sidebar-footer">

        <div className="sidebar-status">
          <span className="status-dot" />
          AI service online
        </div>

        <p>
          Secure AI assistant
        </p>

      </div>

    </aside>
  );
}

export default Sidebar;