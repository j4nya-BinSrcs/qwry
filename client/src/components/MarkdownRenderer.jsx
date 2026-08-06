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
              className="px-1.5 py-0.5 rounded-md bg-hover text-sm text-text font-mono"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className="p-4 my-3 rounded-lg bg-panel text-sm font-mono overflow-x-auto">
              <code className="text-text" {...props}>
                {children}
              </code>
            </pre>
          );
        },
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-text underline decoration-border underline-offset-2 hover:text-muted transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-text mt-5 mb-2 tracking-tight">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-text mt-4 mb-1.5 tracking-tight">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-text mt-3 mb-1">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-text mt-3 mb-1">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-sm text-text leading-relaxed my-2.5">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-sm text-text list-disc pl-5 my-2.5 space-y-1.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-sm text-text list-decimal pl-5 my-2.5 space-y-1.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-4 my-3 italic text-muted text-sm">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-border/60" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full text-sm border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-hover">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-medium text-text">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-text border-t border-border/60">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
