import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const host = 'https://ylxx.szftedu.cn/xx_5828/xydt_5829/bxfbx_6371/';

export const route: Route = {
    path: '/dongtai',
    categories: ['other'],
    example: '/szftedu/dongtai',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '园岭小学动态',
    maintainers: ['Valuex'],
    handler,
    description: ``,
};

async function handler(ctx) {
    const link = host;
    const base_link=`https://ylxx.szftedu.cn`;

    const response = await got(link);
    const $ = load(response.data);
    const category_name = '公告';

    const lists = $('div.pagenews04 div ul li')
        .toArray()
        .map((el) => ({
            title: $('a', el).text().trim(),
            link: $('a', el).attr('href'),
            pubDate: timezone(parseDate($('span[class=canedit]', el).text()), 8),
        }));

    const items = await Promise.all(
        lists.map((item) =>
            cache.tryGet(item.link, async () => {
                let str = item.link;
                let turelink='';
                if (str.includes("http")) {
                    turelink = item.link;
                  } 
                  else 
                  {
                    turelink = base_link + item.link;
                  }
                const response = await got.get(turelink);
                const $ = load(response.data);
                item.description = $('body').html();
                item.pubDate = timezone(parseDate($('#publish_time').first().text()), 8);
                return item;
            })
        )
    );

    return {
        title: '园岭小学动态',
        link:host,
        description: '园岭小学动态',
        item: items,
    };
}