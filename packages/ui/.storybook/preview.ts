import type { Preview } from '@storybook/react';
import '../src/storybook.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
        { name: 'grey', value: '#333333' },
        { name: 'light', value: '#f5f5f5' },
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
      // Toggle dark class based on background selection (default to dark)
      const bgValue = context.globals.backgrounds?.value;
      const isDark = !bgValue || bgValue !== '#f5f5f5';
      document.documentElement.classList.toggle('dark', isDark);
      return Story();
    },
  ],
};

export default preview;
