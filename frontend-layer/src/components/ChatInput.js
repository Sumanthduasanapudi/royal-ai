import React, {
  useEffect,
  useRef,
} from "react";

function ChatInput({
  message,
  setMessage,
  sendMessage,
  loading,
}) {
  const textareaRef =
    useRef(null);

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height =
      "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        150
      )}px`;
  }, [message]);

  const handleKeyDown = (
    event
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (!loading) {
        sendMessage();
      }
    }
  };

  return (
    <div className="input-section">

      <div className="chat-input-area">

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) =>
            setMessage(
              event.target.value
            )
          }
          onKeyDown={
            handleKeyDown
          }
          placeholder="Message Royal AI..."
          maxLength={10000}
          disabled={loading}
          rows={1}
        />

        <button
          className="send-button"
          onClick={sendMessage}
          disabled={
            loading ||
            !message.trim()
          }
        >
          {loading
            ? "..."
            : "Send"}
        </button>

      </div>

      <p className="input-note">
        Royal AI can make mistakes.
        Verify important information.
      </p>

    </div>
  );
}

export default ChatInput;