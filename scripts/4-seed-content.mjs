/**
 * 4-seed-content.mjs — pages, the journal, and the menus.
 *
 * Menus are the part worth reading carefully. §12.5: the mega menu renders
 * `link.links` two levels deep, so Shop must have children *with children* or
 * the mega collapses to a single column and the feature card never appears.
 * The nesting is verified after creation here rather than assumed — a menu
 * that saved one level shallower than intended looks completely fine in admin.
 *
 * Also writes two of the buyer's export files (§12.7): pages-and-articles.md
 * and menus.md, both from the same data that seeded the store.
 *
 * Run: node scripts/4-seed-content.mjs [--offline]
 *
 *   --offline  write the buyer's export files and touch no store. The copy in
 *              them comes from demo-data.mjs, so it has never needed one.
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { log, fail } from './lib/log.mjs';
import { PATHS, ensureDir } from './lib/media.mjs';
import { PAGES, BLOG, ARTICLES, MENUS } from './lib/demo-data.mjs';
import { graphql, mutate, requireCredentials, verifyShop } from './lib/shopify.mjs';
import { appendLog } from './lib/seed-log.mjs';

/* --------------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------------- */

const PAGES_BY_HANDLE = `
  query Pages($query: String!) {
    pages(first: 50, query: $query) {
      nodes { id handle title }
    }
  }
`;

const PAGE_CREATE = `
  mutation PageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { id handle title }
      userErrors { field message code }
    }
  }
`;

const BLOGS = `
  query Blogs {
    blogs(first: 20) {
      nodes { id handle title }
    }
  }
`;

const BLOG_CREATE = `
  mutation BlogCreate($blog: BlogCreateInput!) {
    blogCreate(blog: $blog) {
      blog { id handle title }
      userErrors { field message code }
    }
  }
`;

const ARTICLES_IN_BLOG = `
  query Articles($blogId: ID!) {
    blog(id: $blogId) {
      articles(first: 50) {
        nodes { id handle title }
      }
    }
  }
`;

const ARTICLE_CREATE = `
  mutation ArticleCreate($article: ArticleCreateInput!) {
    articleCreate(article: $article) {
      article { id handle title }
      userErrors { field message code }
    }
  }
`;

const MENUS_QUERY = `
  query Menus {
    menus(first: 30) {
      nodes { id handle title }
    }
  }
`;

// Three levels requested back deliberately: the whole point of verifying is to
// see whether the third one survived.
const MENU_DETAIL = `
  query Menu($id: ID!) {
    menu(id: $id) {
      id
      handle
      items {
        title
        items {
          title
          items { title }
        }
      }
    }
  }
`;

const MENU_CREATE = `
  mutation MenuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
    menuCreate(title: $title, handle: $handle, items: $items) {
      menu { id handle title }
      userErrors { field message code }
    }
  }
`;

const MENU_UPDATE = `
  mutation MenuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
    menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
      menu { id handle title }
      userErrors { field message code }
    }
  }
`;

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

/**
 * Turn a demo-data menu item into Shopify's shape, recursively.
 *
 * Every item is type HTTP with an explicit path. Using COLLECTION or PAGE
 * types would need each target's GID and would fail the moment a target does
 * not exist yet; a path resolves at render time and degrades to a 404 the
 * operator can see rather than a mutation error they have to decode.
 *
 * @param {object} item
 * @returns {object}
 */
function menuItemInput(item) {
  return {
    title: item.title,
    type: 'HTTP',
    url: item.url,
    ...(item.children?.length ? { items: item.children.map(menuItemInput) } : {}),
  };
}

/**
 * How deep a returned menu actually nests.
 * @param {object[]} items
 * @returns {number}
 */
function depthOf(items) {
  if (!items || items.length === 0) return 0;
  return 1 + Math.max(...items.map((item) => depthOf(item.items)));
}

/** @param {number} daysAgo @returns {string} ISO date */
function daysAgoIso(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

const offline = process.argv.includes('--offline');

log.banner(offline ? '4 / 5  Buyer export (offline)' : '4 / 5  Seed content');

if (!offline) {
  requireCredentials();
  const shop = await verifyShop();
  log.info(`Store: ${shop.name} (${shop.myshopifyDomain})`);
} else {
  log.info('Offline: writing the export package only, no store is contacted.');
}

const mapPath = path.join(PATHS.export, 'media-map.json');
const mediaMap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};

if (!offline) {
  /* --- Pages ---------------------------------------------------------------- */

  await log.group('Pages', async () => {
    const query = PAGES.map((page) => `handle:${page.handle}`).join(' OR ');
    const data = await graphql(PAGES_BY_HANDLE, { query }, 'pages');
    const existing = new Set((data.pages?.nodes || []).map((node) => node.handle));

    for (const page of PAGES) {
      if (existing.has(page.handle)) {
        log.skipped(`${page.title} already exists`);
        continue;
      }

      const payload = await mutate(
        PAGE_CREATE,
        {
          page: {
            handle: page.handle,
            title: page.title,
            body: page.body,
            isPublished: true,
            ...(page.templateSuffix ? { templateSuffix: page.templateSuffix } : {}),
          },
        },
        'pageCreate'
      );

      log.created(page.title);
      appendLog('page', page.handle, payload.page.id);
    }
  });

  /* --- Blog ----------------------------------------------------------------- */

  const blogId = await log.group('Blog', async () => {
    const data = await graphql(BLOGS, {}, 'blogs');
    const found = (data.blogs?.nodes || []).find((node) => node.handle === BLOG.handle);

    if (found) {
      log.skipped(`${BLOG.title} already exists`);
      return found.id;
    }

    const payload = await mutate(
      BLOG_CREATE,
      { blog: { handle: BLOG.handle, title: BLOG.title } },
      'blogCreate'
    );

    log.created(BLOG.title);
    appendLog('blog', BLOG.handle, payload.blog.id);
    return payload.blog.id;
  });

  /* --- Articles ------------------------------------------------------------- */

  await log.group('Articles', async () => {
    const data = await graphql(ARTICLES_IN_BLOG, { blogId }, 'articles');
    const existing = new Set((data.blog?.articles?.nodes || []).map((node) => node.handle));

    for (const article of ARTICLES) {
      if (existing.has(article.handle)) {
        log.skipped(`${article.title} already exists`);
        continue;
      }

      const image = article.image && mediaMap[article.image]?.url;

      const payload = await mutate(
        ARTICLE_CREATE,
        {
          article: {
            blogId,
            handle: article.handle,
            title: article.title,
            body: article.body,
            summary: article.excerpt,
            author: { name: article.author },
            isPublished: true,
            // Dates are computed at seed time from a relative offset. Absolute
            // dates in the data file would make the demo store look abandoned
            // within a month of that file being written.
            publishDate: daysAgoIso(article.daysAgo),
            ...(image ? { image: { url: image, altText: article.title } } : {}),
          },
        },
        'articleCreate'
      );

      log.created(`${article.title} (${article.daysAgo}d ago)`);
      if (!image) log.warn(`  no image in the media map for ${article.image}`);
      appendLog('article', article.handle, payload.article.id);
    }
  });

  /* --- Menus ---------------------------------------------------------------- */

  await log.group('Menus', async () => {
    const data = await graphql(MENUS_QUERY, {}, 'menus');
    const existing = new Map((data.menus?.nodes || []).map((node) => [node.handle, node.id]));

    for (const menu of MENUS) {
      const items = menu.items.map(menuItemInput);
      const found = existing.get(menu.handle);

      let id;

      if (found) {
        // Updated rather than skipped. A menu is the one thing here most likely
        // to have been edited by hand between runs, and the nesting is exactly
        // what breaks when it has been.
        const payload = await mutate(
          MENU_UPDATE,
          { id: found, title: menu.title, handle: menu.handle, items },
          'menuUpdate'
        );
        id = payload.menu.id;
        log.skipped(`${menu.title} updated`);
      } else {
        const payload = await mutate(
          MENU_CREATE,
          { title: menu.title, handle: menu.handle, items },
          'menuCreate'
        );
        id = payload.menu.id;
        log.created(menu.title);
        appendLog('menu', menu.handle, id);
      }

      /* Verify the nesting actually took (§12.5). */
      const detail = await graphql(MENU_DETAIL, { id }, 'menu');
      const actual = depthOf(detail.menu?.items || []);
      const expected = depthOf(menu.items.map((item) => ({ ...item, items: item.children })));

      if (menu.handle === 'main-menu') {
        if (actual < 3) {
          log.error(`  main-menu nests ${actual} deep, not 3.`);
          log.error('  The mega menu reads link.links two levels below the top');
          log.error('  item. At this depth it collapses to one column and the');
          log.error('  feature card never renders.');
        } else {
          log.info(`  nesting verified: ${actual} levels`);
        }
      } else if (actual < expected) {
        log.warn(`  ${menu.handle} nests ${actual} deep, expected ${expected}`);
      }
    }
  });
}

/* --------------------------------------------------------------------------
   Buyer export (§12.7)
   -------------------------------------------------------------------------- */

ensureDir(PATHS.export);

await log.group('Writing buyer export', async () => {
  /* pages-and-articles.md — copy ready to paste. */
  const contentMd = `# Pages and journal posts

Copy ready to paste. Neither pages nor blog articles are covered by Shopify's
product CSV import, so these go in by hand — about twenty minutes for the lot.

## Pages

**Content -> Pages -> Add page** for each. Set the handle under *Search engine
listing -> Edit*: the theme's demo navigation links to these by handle, so a
different handle is a broken menu link.

${PAGES.map(
  (page) => `### ${page.title}

- **Handle** \`${page.handle}\`
${page.templateSuffix ? `- **Template** \`page.${page.templateSuffix}\`\n` : ''}
\`\`\`html
${page.body}
\`\`\`
`
).join('\n')}

## Journal

**Content -> Blog posts**. Create a blog with the handle \`${BLOG.handle}\` and
the title \`${BLOG.title}\` first — the theme's navigation links to
\`/blogs/${BLOG.handle}\`.

Stagger the publish dates across the past six weeks. Three posts all dated
today reads as a store that launched this morning.

${ARTICLES.map(
  (article) => `### ${article.title}

- **Handle** \`${article.handle}\`
- **Author** ${article.author}
- **Published** about ${article.daysAgo} days ago
- **Image** \`${article.image}\`
- **Excerpt** ${article.excerpt}

The excerpt matters more than it looks. The theme renders \`article.excerpt\`
and nothing else on a card — it will not truncate your body text to fill the
gap — so a post without one shows a heading, a date, and no summary at all.

\`\`\`html
${article.body}
\`\`\`
`
).join('\n')}

Generated by \`scripts/4-seed-content.mjs\`. Do not edit by hand.
`;

  writeFileSync(path.join(PATHS.export, 'pages-and-articles.md'), contentMd, 'utf8');
  log.created('pages-and-articles.md');

  /* menus.md */
  const renderItems = (items, depth = 0) =>
    items
      .map((item) => {
        const line = `${'  '.repeat(depth)}- **${item.title}** -> \`${item.url}\``;
        return item.children?.length
          ? `${line}\n${renderItems(item.children, depth + 1)}`
          : line;
      })
      .join('\n');

  const menusMd = `# Navigation

**Content -> Menus**. Four menus; the first one is the one that matters.

## The thing to get right

The mega menu reads two levels below each top-level item. **Shop** therefore
needs children *that themselves have children*. With only one level under
Shop, the mega menu collapses to a single column and the feature card never
appears — and nothing warns you, because a two-level menu is perfectly valid.

After building it, hover Shop on the storefront. Four columns and an image
means it worked.

${MENUS.map(
  (menu) => `## ${menu.title}

- **Handle** \`${menu.handle}\`

${renderItems(menu.items)}
`
).join('\n')}

## Handles

The footer sections reference \`footer-shop\`, \`footer-help\` and
\`footer-company\` by handle. Shopify derives a handle from the title when you
create a menu, so check each one under the menu's own settings rather than
assuming.

Generated by \`scripts/4-seed-content.mjs\`. Do not edit by hand.
`;

  writeFileSync(path.join(PATHS.export, 'menus.md'), menusMd, 'utf8');
  log.created('menus.md');
});

log.success(
  offline
    ? `Export written for ${PAGES.length} pages, ${ARTICLES.length} articles and ${MENUS.length} menus. No store contacted.`
    : `${PAGES.length} pages, ${ARTICLES.length} articles, ${MENUS.length} menus.`
);
