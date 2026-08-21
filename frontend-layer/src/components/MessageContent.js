import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MessageContent({ content }) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className="ai-content">

      <button
        className="copy-response-button"
        onClick={copyMessage}
      >
        {copied ? "Copied" : "Copy"}
      </button>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const codeText = String(children).replace(/\n$/, "");

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
                code={codeText}
                className={className}
              />
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>

    </div>
  );
}

function CodeBlock({ code, className }) {
  const [copied, setCopied] = useState(false);

  const language =
    className?.replace("language-", "") || "code";

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className="royal-code-block">

      <div className="code-toolbar">

        <span>
          {language}
        </span>

        <button
          onClick={copyCode}
        >
          {copied ? "Copied" : "Copy code"}
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

export default MessageContent;