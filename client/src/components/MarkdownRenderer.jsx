import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownRenderer({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        strong: ({ children }) => (
          <strong className="font-semibold text-text">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-text">{children}</em>
        ),
        del: ({ children }) => (
          <del className="line-through text-muted">{children}</del>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          return isInline ? (
            <code
              className="px-1 py-0.5 rounded bg-hover text-[11px] text-text font-mono"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className="p-3 my-2 rounded bg-panel border border-border text-xs font-mono overflow-x-auto">
              <code className="text-text" {...props}>
                {children}
              </code>
            </pre>
          );
        },
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <h1 className="text-sm font-bold text-text mt-3 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-text mt-2.5 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-bold text-text mt-2 mb-0.5">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-xs font-semibold text-text mt-2 mb-0.5">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-xs text-text leading-relaxed my-1.5">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-xs text-text list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-xs text-text list-decimal pl-4 my-1.5 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 my-2 italic text-muted text-xs">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border-collapse border border-border">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-hover">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2.5 py-1.5 text-left font-medium text-text border border-border">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2.5 py-1.5 text-text border border-border">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
