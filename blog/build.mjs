// blog.dotstories.com: Markdown posts → static HTML (no JS), with what search engines and link previews need.
// node blog/build.mjs → blog/dist (deployed as its own small Worker, see wrangler.jsonc).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { escape, markdown } from "./markdown.mjs";

export const BLOG = "https://blog.dotstories.com";
export const SITE = "https://dotstories.com";
const HERE = dirname(fileURLToPath(import.meta.url));
const NAME = "DotStories Blog";
const TAGLINE = "What is possible today with AI: workflows you run on your own computer.";

/** `---` frontmatter (title, description, date, cover?) + Markdown body. */
export function parsePost(file, source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = Object.fromEntries(
    (match?.[1] ?? "").split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]),
  );
  for (const key of ["title", "description", "date"])
    if (!meta[key]) throw new Error(`${file}: frontmatter needs a ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date is YYYY-MM-DD`);
  return {
    slug: file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""),
    title: meta.title,
    description: meta.description,
    date: meta.date,
    cover: meta.cover || undefined,
    html: markdown(match[2]),
  };
}

const longDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const absolute = (url) => (url.startsWith("/") ? `${SITE}${url}` : url);
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

function page({ title, description, url, image, type, head = "", body }) {
  const img = image ? absolute(image) : `${SITE}/logo.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/rss+xml" title="${NAME}" href="${BLOG}/feed.xml">
<link rel="icon" href="${SITE}/favicon.ico">
<meta property="og:site_name" content="${NAME}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono&display=swap">
<link rel="stylesheet" href="/style.css">
${head}
</head>
<body>
<header><a class="brand" href="/">${NAME}</a><a href="${SITE}">Open DotStories →</a></header>
<main>
${body}
</main>
<footer><a href="${SITE}">dotstories.com</a> · <a href="/feed.xml">RSS</a></footer>
</body>
</html>
`;
}

function postPage(post) {
  const url = `${BLOG}/${post.slug}`;
  return page({
    title: `${post.title} · ${NAME}`,
    description: post.description,
    url,
    image: post.cover,
    type: "article",
    head: [
      `<meta property="article:published_time" content="${post.date}">`,
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        mainEntityOfPage: url,
        image: post.cover ? absolute(post.cover) : undefined,
        author: { "@type": "Organization", name: "DotStories", url: SITE },
        publisher: { "@type": "Organization", name: "DotStories", url: SITE, logo: `${SITE}/logo.png` },
      }),
    ].join("\n"),
    body: `<article>
<p class="date"><time datetime="${post.date}">${longDate(post.date)}</time></p>
<h1>${escape(post.title)}</h1>
${post.cover ? `<img class="cover" src="${absolute(post.cover)}" alt="">` : ""}
${post.html}
</article>
<p><a href="/">← All posts</a></p>`,
  });
}

function indexPage(posts) {
  return page({
    title: NAME,
    description: TAGLINE,
    url: `${BLOG}/`,
    type: "website",
    head: jsonLd({ "@context": "https://schema.org", "@type": "Blog", name: NAME, url: `${BLOG}/`, description: TAGLINE }),
    body: `<h1>${NAME}</h1>
<p class="lead">${TAGLINE}</p>
<ul class="posts">
${posts
  .map(
    (p) => `<li><a href="/${p.slug}"><span class="date">${longDate(p.date)}</span><strong>${escape(p.title)}</strong><span>${escape(p.description)}</span></a></li>`,
  )
  .join("\n")}
</ul>`,
  });
}

const sitemap = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${BLOG}/</loc>${posts[0] ? `<lastmod>${posts[0].date}</lastmod>` : ""}</url>
${posts.map((p) => `<url><loc>${BLOG}/${p.slug}</loc><lastmod>${p.date}</lastmod></url>`).join("\n")}
</urlset>
`;

const feed = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${NAME}</title><link>${BLOG}/</link><description>${escape(TAGLINE)}</description>
${posts
  .map(
    (p) =>
      `<item><title>${escape(p.title)}</title><link>${BLOG}/${p.slug}</link><guid>${BLOG}/${p.slug}</guid><pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate><description>${escape(p.description)}</description></item>`,
  )
  .join("\n")}
</channel></rss>
`;

/** Every file of the site: { "path": "content" }. Newest posts first. */
export function build(dir = join(HERE, "posts")) {
  const posts = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parsePost(f, readFileSync(join(dir, f), "utf8")))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    "index.html": indexPage(posts),
    ...Object.fromEntries(posts.map((p) => [`${p.slug}.html`, postPage(p)])),
    "404.html": page({
      title: `Not found · ${NAME}`,
      description: TAGLINE,
      url: `${BLOG}/`,
      type: "website",
      head: '<meta name="robots" content="noindex">',
      body: '<h1>Not found</h1><p><a href="/">← All posts</a></p>',
    }),
    "style.css": readFileSync(join(HERE, "style.css"), "utf8"),
    "sitemap.xml": sitemap(posts),
    "robots.txt": `User-agent: *\nAllow: /\nSitemap: ${BLOG}/sitemap.xml\n`,
    "feed.xml": feed(posts),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(HERE, "dist");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out);
  const files = build();
  for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
  console.log(`blog: ${Object.keys(files).length} files → blog/dist`);
}
