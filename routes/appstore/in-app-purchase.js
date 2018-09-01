const axios = require('../../utils/axios');
const url = require('url');
const cheerio = require('cheerio');

module.exports = async (ctx) => {
    const country = ctx.params.country;
    const id = ctx.params.id;
    const link = `https://itunes.apple.com/${country}/app/${id}`;
    const target = url.resolve(link, '?mt=8#see-all/in-app-purchases');

    const res = await axios.get(target);
    const $ = cheerio.load(res.data);
    const titleTemp = $('h1')
        .contents()
        .first()
        .text()
        .trim();
    const list = $('ol.list-with-numbers li.list-with-numbers__item');
    const item = list
        .map((i, e) => {
            const title = `${titleTemp} ${$(e)
                .find('span.list-with-numbers__item__title')
                .text()
                .trim()} ${$(e)
                .find('span.list-with-numbers__item__price')
                .text()
                .trim()}`;
            return {
                link,
                guid: title,
                title,
                pubDate: new Date(Date.now()).toUTCString(),
            };
        })
        .get();

    const platform = $('.we-localnav__title__product').text();

    const title = `${country === 'cn' ? '内购限免提醒' : 'IAP price watcher'}: ${titleTemp} for ${platform.startsWith('App') ? 'iOS' : 'macOS'}`;

    ctx.state.data = {
        title,
        link,
        item,
    };
};
