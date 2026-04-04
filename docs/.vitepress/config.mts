import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'XRSPS',
    description: 'OSRS Leagues V Documentation',
    base: '/',
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Architecture', link: '/ARCHITECTURE' },
        ],
        sidebar: [
            {
                text: 'Documentation',
                items: [
                    { text: 'Architecture', link: '/ARCHITECTURE' },
                ],
            },
        ],
        socialLinks: [
            { icon: 'github', link: 'https://github.com/xrsps/xrsps-typescript' },
        ],
    },
});
