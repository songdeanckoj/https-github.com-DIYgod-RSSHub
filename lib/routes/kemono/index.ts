import { Route } from '@/types';
import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import * as path from 'node:path';

export const route: Route = {
    path: '/:source?/:id?/:limit?',
    categories: ['anime'],
    example: '/kemono',
    parameters: { source: 'Source, see below, Posts by default', id: 'User id, can be found in URL', limit: '(Optional)the maximum number of posts to fetch, deault value is 25.' },
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
            source: ['kemono.su/:source/user/:id', 'kemono.su/'],
        },
    ],
    name: 'Posts',
    maintainers: ['nczitzk'],
    handler,
    description: `Sources

  | Posts | Patreon | Pixiv Fanbox | Gumroad | SubscribeStar | DLsite | Discord | Fantia |
  | ----- | ------- | ------------ | ------- | ------------- | ------ | ------- | ------ |
  | posts | patreon | fanbox       | gumroad | subscribestar | dlsite | discord | fantia |

  :::tip
  When \`posts\` is selected as the value of the parameter **source**, the parameter **id** does not take effect.
  There is an optinal parameter **limit** which controls the number of posts to fetch, default value is 25.
  :::`,
};

async function handler(ctx) {
    const limit = ctx.req.param('limit') ? Number.parseInt(ctx.req.param('limit')) : 25;
    const source = ctx.req.param('source') ?? 'posts';
    const id = ctx.req.param('id');
    const isPosts = (source === 'posts');

    const rootUrl = 'https://kemono.su';
	const apiUrl = `${rootUrl}/api/v1`;
    const discordUrl = `${rootUrl}/api/v1/discord/channel/lookup/${id}`;
	const currentUrl = isPosts ? `${apiUrl}/posts` : `${apiUrl}/${source}/user/${id}`;

    const headers = {
        cookie: '__ddg2=sBQ4uaaGecmfEUk7',
    };

    const response = await got({
        method: 'get',
        url: source === 'discord' ? discordUrl : currentUrl,
        headers,
    });

    let items = <any>[],
        title = '',
        image;

    if (source === 'discord') {
        title = `Posts of ${id} from Discord | Kemono`;

        items = await Promise.all(
            response.data.map((channel) =>
                cache.tryGet(channel.id, async () => {
                    const channelResponse = await got({
                        method: 'get',
                        url: `${rootUrl}/api/v1/discord/channel/${channel.id}?o=0`,
                        headers,
                    });

                    return channelResponse.data
                        .filter((i) => i.content || i.attachments)
                        .slice(0, limit)
                        .map((i) => ({
                            title: i.content,
                            description: art(path.join(__dirname, 'templates', 'discord.art'), { i }),
                            author: `${i.author.username}#${i.author.discriminator}`,
                            pubDate: parseDate(i.published),
                            category: channel.name,
                            guid: `kemono:${source}:${i.server}:${i.channel}:${i.id}`,
                            link: `https://discord.com/channels/${i.server}/${i.channel}/${i.id}`,
                        }));
                })
            )
        );
        items = items.flat();
    } else if(!isPosts) {
        const profileResponse = await got({
            method: 'get',
            url: `${currentUrl}/profile`,
            headers,
        });
        
        const author = profileResponse.data.name;
        title = `Posts of ${author} from ${source} | Kemono`;
        image = `img.kemono.su/icons/${source}/${id}`;
        items = response.data
		.filter((i) => i.content || i.attachments)
        .slice(0, limit)
		.map((i) => {
			i.files = [];
			if('path' in i.file){
				i.files.push({
                    name: i.file.name, 
                    path: i.file.path, 
                    extension: i.file.path.replace(/.*\./, "").toLowerCase(),
                });	
			}
            for (let attachment of i.attachments){
                i.files.push({
					name: attachment.name,
					path: attachment.path,
					extension: attachment.path.replace(/.*\./, "").toLowerCase(),
				});
            }
            
            const filesHTML = art(path.join(__dirname, 'templates', 'source.art'), { i });
            let $ = load(filesHTML);
            let kemonoFiles = Array<string>();
            $("img, a, audio, video").each(function(){
                kemonoFiles.push($(this).prop("outerHTML")!);
            });
            let desc = "";
            if (i.content!=""){
                desc += `<div>${i.content}</div>`;
            }
            $ = load(desc);
            let count = 0;
            let regex = new RegExp("downloads.fanbox.cc");
            $('a').each(function(){
                let link = $(this).attr('href');
                if(regex.test(link!)){
                    count++; 
                    $(this).replaceWith(kemonoFiles[count]);
                }
            });
            desc = (kemonoFiles.length > 0 ? kemonoFiles[0] : "") + $.html();
            for (let kemonoFile of kemonoFiles.slice(count+1)) {
                desc += kemonoFiles[kemonoFile];
            }

			return {
				title: i.title,
				description: desc,
				author: author,
				pubDate: parseDate(i.published),
				guid: `${currentUrl}/post/${i.id}`,
				link: `${rootUrl}/${i.service}/user/${i.user}/post/${i.id}`,
			};
        });
    } else {
            title = "Kemono Posts";
            image = `${rootUrl}/favicon.ico`;
            items = response.data
            .filter((i) => i.content || i.attachments)
            .slice(0, limit)
            .map((i) => ({
                title: i.title,
                link: `${rootUrl}/${i.service}/user/${i.user}/post/${i.id}`
            }));
        }

    return {
        title,
        image,
        link: isPosts ? `${rootUrl}/posts` : (source === 'discord' ? `${rootUrl}/${source}/server/${id}` : `${rootUrl}/${source}/user/${id}`),
        item: items,
    };
}
