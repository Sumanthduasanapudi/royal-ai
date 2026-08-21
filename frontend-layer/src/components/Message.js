import React, {
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({
  children,
  className,
}) {
  const [copied, setCopied] =
    useState(false);

  const code =
    String(children || "")
      .replace(/\n$/, "");

  const language =
    className
      ?.replace(
        "language-",
        ""
      ) || "code";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopied(true);

      setTimeout(
        () => setCopied(false),
        1500
      );
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  };

  return (
    <div className="code-block">

      <div className="code-header">

        <span>
          {language}
        </span>

        <button
          onClick={copyCode}
        >
          {copied
            ? "Copied"
            : "Copy"}
        </button>

      </div>

      <pre>
        <code>
          {code}
        </code>
      </pre>

    </div>
  );
}

function Message({
  message,
}) {
  const isUser =
    message.role === "user";

  const [copied, setCopied] =
    useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(
        message.content
      );

      setCopied(true);

      setTimeout(
        () => setCopied(false),
        1500
      );
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  };

  return (
    <div
      className={
        isUser
          ? "message-row user-row"
          : "message-row assistant-row"
      }
    >

      {!isUser && (
        <div className="message-avatar assistant-avatar">
          R
        </div>
      )}

      <div
        className={
          isUser
            ? "message user-message"
            : "message assistant-message"
        }
      >

        <div className="message-top">

          <span className="message-role">
            {isUser
              ? "YOU"
              : "ROYAL AI"}
          </span>

          <button
            className="copy-message-button"
            onClick={copyMessage}
          >
            {copied
              ? "Copied"
              : "Copy"}
          </button>

        </div>

        {isUser ? (

          <p className="user-text">
            {message.content}
          </p>

        ) : (

          <div className="markdown-content">

            <ReactMarkdown
              remarkPlugins={[
                remarkGfm,
              ]}
              components={{
                code({
                  inline,
                  className,
                  children,
                  ...props
                }) {
                  if (inline) {
                    return (
                      <code
                        className="inline-code"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock
                      className={
                        className
                      }
                    >
                      {children}
                    </CodeBlock>
                  );
                },

                a({
                  children,
                  ...props
                }) {
                  return (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>

          </div>

        )}

      </div>

      {isUser && (
        <div className="message-avatar user-avatar">
          U
        </div>
      )}

    </div>
  );
}

export default Message;