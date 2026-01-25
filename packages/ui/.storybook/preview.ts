import type { Preview } from '@storybook/react';
import '../src/storybook.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story, context) => {
      // Toggle dark class based on background
      const isDark = context.globals.backgrounds?.value === '#1a1a1a';
      document.documentElement.classList.toggle('dark', isDark);
      return Story();
    },
  ],
};

export default preview;
