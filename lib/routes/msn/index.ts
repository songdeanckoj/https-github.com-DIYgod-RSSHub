import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';

const apiKey = '0QfOX3Vn51YCzitbLaRkTTBadtWpgTN8NZLW0C1SEM';

export const route: Route = {
    path: '/:market/:name/:id',
    categories: ['traditional-media'],
    example: '/zh-tw/Bloomberg/sr-vid-08gw7ky4u229xjsjvnf4n6n7v67gxm0pjmv9fr4y2x9jjmwcri4s',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['https://www.msn.com/:market/channel/source/:name/:id'],
            target: '/:market/:name/:id',
        },
    ],
    name: 'MSN News',
    maintainers: ['KTachibanaM'],
    handler: async (ctx) => {
        const { market, name, id } = ctx.req.param();
        let truncatedId = id;
        if (truncatedId.startsWith('sr-')) {
            truncatedId = truncatedId.substring(3);
        }

        const pageData = await ofetch(`https://www.msn.com/${market}/channel/source/${name}/${id}`);
        const $ = load(pageData);
        const headElement = $('head');
        const dataClientSettings = headElement.attr('data-client-settings') ?? '{}';
        const parsedSettings = JSON.parse(dataClientSettings);
        const requestMuid = parsedSettings.fd_muid;

        const jsonData = await ofetch(`https://assets.msn.com/service/news/feed/pages/providerfullpage?market=${market}&query=newest&CommunityProfileId=${truncatedId}&apikey=${apiKey}&user=m-${requestMuid}`);
        const items = jsonData.sections[0].cards.map((card) => ({
            title: card.title,
            link: card.url,
            description: card.abstract,
            pubDate: parseDate(card.publishedDateTime),
            category: [card.category],
        }));

        const channelLink = `https://www.msn.com/${market}/channel/source/${name}/${id}`;
        return {
            title: name,
            link: channelLink,
            item: items,
        };
    },
};
