import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio'; // 可以使用类似 jQuery 的 API HTML 解析器

const baseUrl = 'https://jwc.scu.edu.cn/tzgg.htm';
const baseIndexUrl = 'https://jwc.scu.edu.cn/';

export const route: Route = {
    path: '/jwc',
    categories: ['university'],
    example: '/scu/jwc',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['jwc.scu.edu.cn'],
            target: '/jwc',
        },
    ],
    name: '教务处通知公告',
    maintainers: ['Kyle'],
    handler,
};

async function handler() {
    const { data: response } = await got.get(baseUrl);
    const $ = load(response);

    const links: string[] = $('.tz-list ul li a')
        .toArray()
        .map((item) => {
            item = $(item);
            const link: string = item.attr('href');
            return link.startsWith('http') ? link : baseIndexUrl + link;
        });

    const items = await Promise.all(
        links.map(async (link) => {
            const { data: info } = await got.get(link);
            const $ = load(info);

            // 获取head里的meta标签
            const title = $('head meta[name="ArticleTitle"]').attr('content');
            const pubDate = parseDate($('head meta[name="PubDate"]').attr('content'));
            const description = $('.v_news_content').html();
            return {
                title,
                link,
                pubDate,
                description,
            };
        })
    );

    return {
        title: '四川大学教务处',
        link: baseIndexUrl,
        description: '四川大学教务处通知公告',
        item: items,
    };
}
