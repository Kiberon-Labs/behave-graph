import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  site: 'https://behave-graph.kinforge.co.za',
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
          href: 'https://github.com/new-horizon-organisation/behave-graph'
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
          label: 'Guides',
          autogenerate: { directory: 'guides' }
        },
                {
          label: 'Flow',
          autogenerate: { directory: 'flow' }
        },
        {
          label: 'Reference',
          items: [
            {
              label: 'Nodes',
              autogenerate: { directory: 'reference/nodes' }
            }
          ]
        }
      ]
    }),
    react()
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
