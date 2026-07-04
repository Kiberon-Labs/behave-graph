import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Kiberon Labs is the canonical author/publisher of the site. Surfaced as
// <meta>/<link> author tags and schema.org JSON-LD for search engines & LLMs.
const AUTHOR = { name: 'Kiberon Labs', url: 'https://kiberonlabs.com' };
const SITE_DESCRIPTION =
  'Build and execute powerful, modular behavior graphs for AI agents, game logic, and complex workflows.';

export default defineConfig({
  // `base` makes Astro/Starlight prefix every asset, stylesheet, script,
  // favicon and internal link with `/behave-graph/`, so nothing is requested
  // from the domain root. Override both with an env var when serving from a
  // custom domain at the root (e.g. set SITE + BASE=/ in that environment).
  site: process.env.SITE_URL ?? 'https://behave.kiberonlabs.com',
  base: process.env.SITE_BASE ?? '/',
  // The inline docs playground was removed; the standalone editor is now the
  // one and only playground. Keep old links working.
  redirects: {
    '/flow/playground': '/editor'
  },
  integrations: [
    starlight({
      title: 'Behave Graphs',
      description: SITE_DESCRIPTION,
      components: {
        // Adds a "Playground" button next to the header social icons.
        SocialIcons: './src/components/SocialIcons.astro',
        // Default the site to dark mode (matches the graph-grammar docs).
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        // Co-branded header logos (Kiberon Labs × Behave Graph) beside the title.
        SiteTitle: './src/components/SiteTitle.astro',
        // Per-page Open Graph / Twitter card images in the default <head>.
        Head: './src/components/Head.astro',
        // Append a "Built by Kiberon Labs" backlink below the default footer.
        Footer: './src/components/Footer.astro'
      },
      // Point search engines / social cards / LLMs at Kiberon Labs as the
      // canonical author and publisher of the documentation.
      head: [
        { tag: 'meta', attrs: { name: 'author', content: AUTHOR.name } },
        { tag: 'meta', attrs: { name: 'publisher', content: AUTHOR.name } },
        { tag: 'link', attrs: { rel: 'author', href: AUTHOR.url } },
        {
          tag: 'meta',
          attrs: { property: 'og:site_name', content: 'Behave Graphs' }
        },
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Behave Graphs',
            description: SITE_DESCRIPTION,
            author: {
              '@type': 'Organization',
              name: AUTHOR.name,
              url: AUTHOR.url
            },
            publisher: {
              '@type': 'Organization',
              name: AUTHOR.name,
              url: AUTHOR.url
            }
          })
        }
      ],
      customCss: [
        // Path to your Tailwind base styles:
        './src/styles/global.css'
      ],
      plugins: [
        starlightLinksValidator({
          errorOnRelativeLinks: false
        })
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Kiberon-Labs/behave-graph'
        },
        // Also makes Starlight emit twitter:site, attributing social cards
        // to the Kiberon Labs account.
        {
          icon: 'x.com',
          label: 'X',
          href: 'https://x.com/kiberonlabs'
        },
        {
          icon: 'discord',
          label: 'Community Discord',
          href: 'https://discord.gg/99J9YSsHv'
        }
      ],
      sidebar: [
        // The interactive playground is the standalone full-screen editor at
        // <base>editor/. Base-relative; Starlight prepends the configured base.
        {
          label: 'Playground',
          link: '/editor/',
          attrs: { rel: 'noopener' }
        },
        {
          label: 'Introduction',
          autogenerate: { directory: 'intro' }
        },
        {
          label: 'Core Concepts',
          autogenerate: { directory: 'core-concepts' }
        },
        {
          label: 'Manifests',
          autogenerate: { directory: 'manifests' }
        },
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' }
        },
        {
          label: 'Flow',
          autogenerate: { directory: 'flow' }
        },
        {
          label: 'VS Code Extension',
          autogenerate: { directory: 'vscode' }
        }
      ]
    }),
    react()
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
