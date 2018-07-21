const axios = require('../../../utils/axios');
const config = require('../../../config');

module.exports = async (ctx) => {
    const bgmCalendarUrl = 'https://api.bgm.tv/calendar';
    const bgmDataUrl = 'https://cdn.jsdelivr.net/npm/bangumi-data/dist/data.json';

    const url = [bgmCalendarUrl, bgmDataUrl];

    const cache = await Promise.all(ctx.cache ? url.map(ctx.cache.get) : url);
    const result = await Promise.all(
        cache.map(async (c, i) => {
            if (ctx.cache && c) {
                return Promise.resolve(JSON.parse(c));
            } else {
                const response = await axios({
                    method: 'get',
                    url: url[i],
                    headers: {
                        'User-Agent': config.ua,
                    },
                });
                const data = response.data;
                if (i === 1) {
                    // 只保留有 bangumi id 的番剧
                    const length = data.items.length;
                    const items = [];
                    for (let index = 0; index < length; index++) {
                        const item = data.items[index];
                        const bgm_site = item.sites.find((s) => s.site === 'bangumi');
                        if (bgm_site) {
                            item.bgm_id = bgm_site.id;
                            items.push(item);
                        }
                    }
                    data.items = items;
                }
                if (ctx.cache) {
                    ctx.cache.set(url[i], JSON.stringify(data), 86400);
                }
                return Promise.resolve(data);
            }
        })
    );

    return result;
};
