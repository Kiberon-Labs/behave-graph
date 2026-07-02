import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  // `base` makes Astro/Starlight prefix every asset, stylesheet, script,
  // favicon and internal link with `/behave-graph/`, so nothing is requested
  // from the domain root. Override both with an env var when serving from a
  // custom domain at the root (e.g. set SITE + BASE=/ in that environment).
  site: process.env.SITE_URL ?? 'https://bg.kiberonlabs.com',
  base: process.env.SITE_BASE ?? '/',
  integrations: [
    starlight({
      title: 'Behave Graphs',
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
        }
      ],
      sidebar: [
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
