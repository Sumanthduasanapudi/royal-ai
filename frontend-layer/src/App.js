import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";
import MessageContent from "./components/MessageContent";

/*
=========================================================
API CONFIGURATION
=========================================================

LOCAL:
REACT_APP_API_URL=http://localhost:5000/api

DEPLOYED:
REACT_APP_API_URL=https://your-backend-url/api

This means we DO NOT need to hard-code
your laptop IP address inside App.js.
*/

const API_URL =
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000/api";

function App() {
  /* =====================================================
     STATE
  ===================================================== */

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [documentId, setDocumentId] =
    useState(null);

  const [
    uploadedFileName,
    setUploadedFileName,
  ] = useState("");

  const [uploading, setUploading] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  /* =====================================================
     CHAT HISTORY
  ===================================================== */

  const [chats, setChats] = useState(() => {
    try {
      const savedChats =
        localStorage.getItem(
          "royal-ai-chats"
        );

      return savedChats
        ? JSON.parse(savedChats)
        : [];
    } catch (error) {
      console.error(
        "Unable to load chat history:",
        error
      );

      return [];
    }
  });

  const [
    activeChatId,
    setActiveChatId,
  ] = useState(null);

  /* =====================================================
     REFERENCES
  ===================================================== */

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  /* =====================================================
     SAVE CHAT HISTORY
  ===================================================== */

  useEffect(() => {
    try {
      localStorage.setItem(
        "royal-ai-chats",
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error(
        "Unable to save chat history:",
        error
      );
    }
  }, [chats]);

  /* =====================================================
     AUTO SCROLL
  ===================================================== */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  /* =====================================================
     UPDATE ACTIVE CHAT
  ===================================================== */

  useEffect(() => {
    if (
      !activeChatId ||
      messages.length === 0
    ) {
      return;
    }

    setChats((currentChats) =>
      currentChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages,
              updatedAt: Date.now(),
            }
          : chat
      )
    );
  }, [messages, activeChatId]);

  /* =====================================================
     CREATE CHAT
  ===================================================== */

  const createChatIfNeeded = (
    firstMessage
  ) => {
    if (activeChatId) {
      return activeChatId;
    }

    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const title =
      firstMessage.length > 32
        ? `${firstMessage.substring(
            0,
            32
          )}...`
        : firstMessage;

    const newChat = {
      id,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setChats((currentChats) => [
      newChat,
      ...currentChats,
    ]);

    setActiveChatId(id);

    return id;
  };

  /* =====================================================
     NEW CHAT
  ===================================================== */

  const newChat = () => {
    setMessages([]);
    setInput("");
    setError("");

    setSelectedFile(null);
    setDocumentId(null);
    setUploadedFileName("");

    setActiveChatId(null);
    setSidebarOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =====================================================
     OPEN OLD CHAT
  ===================================================== */

  const openChat = (chat) => {
    setActiveChatId(chat.id);

    setMessages(
      Array.isArray(chat.messages)
        ? chat.messages
        : []
    );

    /*
    Document IDs are not restored.

    Our current RAG document storage is temporary
    on the AI server, so an old document ID might
    no longer exist after a server restart.
    */

    setSelectedFile(null);
    setDocumentId(null);
    setUploadedFileName("");

    setError("");
    setSidebarOpen(false);
  };

  /* =====================================================
     DELETE CHAT
  ===================================================== */

  const deleteChat = (
    event,
    chatId
  ) => {
    event.stopPropagation();

    setChats((currentChats) =>
      currentChats.filter(
        (chat) => chat.id !== chatId
      )
    );

    if (activeChatId === chatId) {
      setMessages([]);
      setInput("");
      setActiveChatId(null);

      setSelectedFile(null);
      setDocumentId(null);
      setUploadedFileName("");

      setError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /* =====================================================
     FILE PICKER
  ===================================================== */

  const openFilePicker = () => {
    if (uploading || loading) {
      return;
    }

    fileInputRef.current?.click();
  };

  /* =====================================================
     FILE SELECTION
  ===================================================== */

  const handleFileChange = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase();

    const allowedExtensions = [
      "pdf",
      "txt",
      "docx",
    ];

    if (
      !allowedExtensions.includes(
        extension
      )
    ) {
      setError(
        "Only PDF, TXT and DOCX files are allowed."
      );

      event.target.value = "";

      return;
    }

    const maxFileSize =
      10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      setError(
        "Maximum file size is 10 MB."
      );

      event.target.value = "";

      return;
    }

    setSelectedFile(file);

    setDocumentId(null);

    setUploadedFileName("");

    setError("");

    await uploadDocument(file);
  };

  /* =====================================================
     DOCUMENT UPLOAD
  ===================================================== */

  const uploadDocument = async (
    file
  ) => {
    try {
      setUploading(true);
      setError("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          `${API_URL}/documents/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "Backend returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.detail ||
            "Document upload failed."
        );
      }

      const newDocumentId =
        data.document?.id ||
        data.document_id ||
        data.id;

      if (!newDocumentId) {
        throw new Error(
          "Upload succeeded but document ID was not returned."
        );
      }

      setDocumentId(
        newDocumentId
      );

      setUploadedFileName(
        data.document?.filename ||
          file.name
      );
    } catch (error) {
      console.error(
        "Document upload error:",
        error
      );

      setError(
        error.message ||
          "Unable to upload document."
      );

      setSelectedFile(null);
      setDocumentId(null);
      setUploadedFileName("");

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    } finally {
      setUploading(false);
    }
  };

  /* =====================================================
     NORMAL CHAT
  ===================================================== */

  const sendNormalChat = async (
    message,
    history
  ) => {
    const response =
      await fetch(
        `${API_URL}/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message,
            history,
          }),
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Backend returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.detail ||
          "Chat request failed."
      );
    }

    return (
      data.data?.reply ||
      data.reply ||
      "No response received."
    );
  };

  /* =====================================================
     DOCUMENT / RAG CHAT
  ===================================================== */

  const sendRagChat = async (
    message,
    history
  ) => {
    if (!documentId) {
      throw new Error(
        "Please upload a document first."
      );
    }

    const response =
      await fetch(
        `${API_URL}/rag/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message,
            document_id:
              documentId,
            history,
          }),
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Backend returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.detail ||
          "Document chat failed."
      );
    }

    return (
      data.data?.reply ||
      data.reply ||
      "No response received."
    );
  };

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  const sendMessage = async () => {
    const cleanMessage =
      input.trim();

    if (
      !cleanMessage ||
      loading ||
      uploading
    ) {
      return;
    }

    createChatIfNeeded(
      cleanMessage
    );

    const previousMessages =
      [...messages];

    const userMessage = {
      role: "user",
      content: cleanMessage,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setInput("");
    setLoading(true);
    setError("");

    try {
      const history =
        previousMessages.map(
          (message) => ({
            role:
              message.role,

            content:
              message.content,
          })
        );

      let reply;

      if (documentId) {
        reply =
          await sendRagChat(
            cleanMessage,
            history
          );
      } else {
        reply =
          await sendNormalChat(
            cleanMessage,
            history
          );
      }

      const assistantMessage = {
        role: "assistant",
        content: reply,
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      setError(
        error.message ||
          "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     ENTER KEY
  ===================================================== */

  const handleKeyDown = (
    event
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  };

  /* =====================================================
     REMOVE DOCUMENT
  ===================================================== */

  const removeDocument = () => {
    setSelectedFile(null);

    setDocumentId(null);

    setUploadedFileName("");

    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="royal-layout">

      {/* MOBILE SIDEBAR OVERLAY */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"

          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`royal-sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
      >

        <div className="sidebar-brand">

          <div className="brand-logo">
            ◆
          </div>

          <div>
            <strong>
              ROYAL AI
            </strong>

            <span>
              Intelligence
            </span>
          </div>

        </div>

        <button
          className="sidebar-new-chat"
          onClick={newChat}
        >
          <span>＋</span>

          New Chat
        </button>

        <div className="sidebar-section-title">
          RECENT CHATS
        </div>

        <div className="chat-history">

          {chats.length === 0 && (
            <div className="no-chats">
              No conversations yet
            </div>
          )}

          {[...chats]
            .sort(
              (a, b) =>
                (b.updatedAt || 0) -
                (a.updatedAt || 0)
            )
            .map((chat) => (

              <button
                key={chat.id}

                className={`history-item ${
                  activeChatId ===
                  chat.id
                    ? "history-active"
                    : ""
                }`}

                onClick={() =>
                  openChat(chat)
                }
              >

                <span className="history-icon">
                  ◇
                </span>

                <span className="history-title">
                  {chat.title}
                </span>

                <span
                  className="history-delete"

                  title="Delete chat"

                  onClick={(event) =>
                    deleteChat(
                      event,
                      chat.id
                    )
                  }
                >
                  ×
                </span>

              </button>

            ))}

        </div>

        <div className="sidebar-bottom">

          <div className="system-status">

            <span className="status-dot" />

            Royal AI Online

          </div>

          <div className="version-text">
            Royal AI • MVP
          </div>

        </div>

      </aside>

      {/* MAIN APPLICATION */}

      <div className="app">

        {/* HEADER */}

        <header className="header">

          <button
            className="mobile-menu-button"

            aria-label="Open menu"

            onClick={() =>
              setSidebarOpen(true)
            }
          >
            ☰
          </button>

          <div className="header-title">

            <h1>
              Royal AI
            </h1>

            <p>
              Intelligent Assistant
            </p>

          </div>

          <button
            className="new-chat-top-button"
            onClick={newChat}
          >
            + New Chat
          </button>

        </header>

        {/* CHAT */}

        <main className="chat-container">

          {messages.length === 0 && (

            <div className="welcome">

              <div className="welcome-badge">
                ROYAL INTELLIGENCE
              </div>

              <h2>
                How can I help you?
              </h2>

              <p>
                Chat with Royal AI or
                attach a PDF, DOCX or TXT
                document and ask questions
                about its content.
              </p>

              <div className="quick-actions">

                <button
                  onClick={() =>
                    setInput(
                      "Explain a topic to me"
                    )
                  }
                >
                  <span>✦</span>

                  Explain something
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Help me write code"
                    )
                  }
                >
                  <span>
                    &lt;/&gt;
                  </span>

                  Write code
                </button>

                <button
                  onClick={
                    openFilePicker
                  }
                >
                  <span>▣</span>

                  Analyze document
                </button>

              </div>

            </div>

          )}

          {/* MESSAGES */}

          {messages.map(
            (message, index) => (

              <div
                key={`${message.role}-${index}`}

                className={`message ${
                  message.role ===
                  "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
              >

                <div className="message-role">

                  {message.role ===
                  "user"
                    ? "You"
                    : "Royal AI"}

                </div>

                <div className="message-content">

                  {message.role ===
                  "assistant" ? (

                    <MessageContent
                      content={
                        message.content
                      }
                    />

                  ) : (

                    message.content

                  )}

                </div>

              </div>

            )
          )}

          {/* THINKING */}

          {loading && (

            <div className="message assistant-message">

              <div className="message-role">
                Royal AI
              </div>

              <div className="message-content">

                <div className="thinking-dots">
                  <span />
                  <span />
                  <span />
                </div>

              </div>

            </div>

          )}

          <div ref={bottomRef} />

        </main>

        {/* ERROR */}

        {error && (

          <div className="frontend-error">
            ⚠ {error}
          </div>

        )}

        {/* DOCUMENT STATUS */}

        {(selectedFile ||
          documentId) && (

          <div className="document-section">

            <div className="uploaded-document">

              <div className="document-file-icon">
                ▣
              </div>

              <div className="document-details">

                <strong>

                  {uploadedFileName ||
                    selectedFile?.name}

                </strong>

                <span>

                  {uploading
                    ? "Uploading document..."
                    : documentId
                    ? "Document Intelligence ready"
                    : "Preparing document..."}

                </span>

              </div>

              {documentId && (

                <span className="ready-text">
                  ✓ Ready
                </span>

              )}

              <button
                className="remove-file-button"

                onClick={
                  removeDocument
                }

                aria-label="Remove document"
              >
                ×
              </button>

            </div>

          </div>

        )}

        {/* MESSAGE COMPOSER */}

        <div className="composer-wrapper">

          <div className="input-container">

            <input
              ref={fileInputRef}

              type="file"

              accept=".pdf,.txt,.docx"

              onChange={
                handleFileChange
              }

              hidden
            />

            <button
              className="attachment-button"

              onClick={
                openFilePicker
              }

              disabled={
                uploading ||
                loading
              }

              title="Attach document"

              aria-label="Attach document"
            >
              ＋
            </button>

            <textarea
              value={input}

              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }

              onKeyDown={
                handleKeyDown
              }

              placeholder={
                documentId
                  ? "Ask about your document..."
                  : "Message Royal AI..."
              }

              rows="1"

              disabled={loading}
            />

            <button
              className="send-button"

              onClick={
                sendMessage
              }

              disabled={
                loading ||
                uploading ||
                !input.trim()
              }

              aria-label="Send message"
            >
              {loading
                ? "•••"
                : "➤"}
            </button>

          </div>

          <div className="composer-note">
            Royal AI can make mistakes.
            Verify important information.
          </div>

        </div>

      </div>

    </div>
  );
}

export default App;