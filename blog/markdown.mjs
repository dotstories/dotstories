// The small Markdown the blog needs: headings, paragraphs, lists, quotes, code, links, images.
// HTML in a post is escaped (shown, never run).

export const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (url) => (/^(https?:|\/|#|mailto:)/i.test(url) ? url : null);
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inline(text) {
  // Code spans first: nothing inside them is formatted.
  return text
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code>${escape(part.slice(1, -1))}</code>`;
      return escape(part)
        .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
          safeUrl(url) ? `<img src="${url}" alt="${alt}" loading="lazy">` : alt,
        )
        .replace(/\[([^\]]+)\]\(([^\s]+?)\)(?!\))/g, (_, label, url) =>
          safeUrl(url) ? `<a href="${url}">${label}</a>` : label,
        )
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
    })
    .join("");
}

export function markdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const until = (stop) => {
    const block = [];
    while (i < lines.length && !stop(lines[i])) block.push(lines[i++]);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      i++;
      const code = until((l) => l.startsWith("```"));
      i++;
      out.push(`<pre><code${lang ? ` class="language-${escape(lang)}"` : ""}>${escape(code.join("\n"))}</code></pre>`);
    } else if (/^#{1,4} /.test(line)) {
      const level = line.indexOf(" ");
      const html = inline(line.slice(level + 1).trim());
      out.push(`<h${level} id="${slugify(html)}">${html}</h${level}>`);
      i++;
    } else if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d/.test(line);
      const items = until((l) => !(ordered ? /^\d+\. / : /^[-*] /).test(l));
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((l) => `<li>${inline(l.replace(/^(\d+\.|[-*]) /, ""))}</li>`).join("")}</${tag}>`);
    } else if (line.startsWith(">")) {
      const quote = until((l) => !l.startsWith(">")).map((l) => l.replace(/^> ?/, ""));
      out.push(`<blockquote>${markdown(quote.join("\n"))}</blockquote>`);
    } else {
      const para = until((l) => !l.trim() || /^(#{1,4} |```|>|[-*] |\d+\. )/.test(l));
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}
