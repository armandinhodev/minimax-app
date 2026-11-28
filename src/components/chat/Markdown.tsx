"use client";

/**
 * Markdown — assistant replies are GFM, not plain text.
 *
 * react-markdown renders the subset MiniMax returns (lists, bold, code,
 * tables, links) without raw HTML, so a reply cannot inject markup. Links open
 * in a new tab; images load lazily.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./markdown.module.css";

export function Markdown({ content }: { content: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            void node;
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
          img: ({ node, ...props }) => {
            void node;
            return <img {...props} loading="lazy" alt={props.alt ?? ""} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
