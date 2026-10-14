// pnpm test:blog : the blog build is plain Node, no dependencies.
import assert from "node:assert/strict";
import { test } from "node:test";
import { markdown } from "./markdown.mjs";
import { BLOG, build, parsePost } from "./build.mjs";

test("markdown: headings, paragraphs, emphasis, links, code", () => {
  assert.equal(markdown("## Hi\n\nA **bold** and *soft* [link](https://x.dev)."), '<h2 id="hi">Hi</h2>\n<p>A <strong>bold</strong> and <em>soft</em> <a href="https://x.dev">link</a>.</p>');
  assert.equal(markdown("Use `a < b` here"), "<p>Use <code>a &lt; b</code> here</p>");
  assert.equal(markdown("```py\nx = 1\n\ny = 2\n```"), '<pre><code class="language-py">x = 1\n\ny = 2</code></pre>');
});

test("markdown: lists, quotes, images", () => {
  assert.equal(markdown("- one\n- two"), "<ul><li>one</li><li>two</li></ul>");
  assert.equal(markdown("1. one\n2. two"), "<ol><li>one</li><li>two</li></ol>");
  assert.equal(markdown("> said"), "<blockquote><p>said</p></blockquote>");
  assert.equal(markdown("![A gate](/g.jpg)"), '<p><img src="/g.jpg" alt="A gate" loading="lazy"></p>');
});

test("markdown: HTML in posts is shown, never run", () => {
  assert.equal(markdown("<script>x</script>"), "<p>&lt;script&gt;x&lt;/script&gt;</p>");
  assert.equal(markdown("[x](javascript:alert(1))"), "<p>x</p>");
});

test("a post needs a title, description and date", () => {
  const post = parsePost("hello.md", "---\ntitle: Hello\ndescription: First post\ndate: 2026-10-14\n---\n\nBody");
  assert.deepEqual({ ...post, html: undefined }, { slug: "hello", title: "Hello", description: "First post", date: "2026-10-14", cover: undefined, html: undefined });
  assert.throws(() => parsePost("x.md", "---\ntitle: X\n---\nBody"), /description/);
});

test("the build: pages with SEO, sitemap, robots, feed", () => {
  const files = build();
  const [slug] = Object.keys(files).filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "404.html");
  const page = files[slug];
  const url = `${BLOG}/${slug.replace(/\.html$/, "")}`;
  assert.match(page, new RegExp(`<link rel="canonical" href="${url}">`));
  assert.match(page, /<meta property="og:type" content="article">/);
  assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(page, /"@type":"BlogPosting"/);
  assert.match(files["index.html"], new RegExp(`href="/${slug.replace(/\.html$/, "")}"`));
  assert.match(files["sitemap.xml"], new RegExp(`<loc>${url}</loc>`));
  assert.match(files["robots.txt"], new RegExp(`Sitemap: ${BLOG}/sitemap.xml`));
  assert.match(files["feed.xml"], /<rss version="2.0"/);
});
