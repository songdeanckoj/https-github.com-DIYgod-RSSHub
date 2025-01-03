import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

import { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import path from 'node:path';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';

export const baseUrl = 'https://visionias.in';

export async function extractNews(item, selector) {
    if (item.link === '') {
        return item;
    }
    const response = await ofetch(item.link || '');
    const $$ = load(response);
    const content = $$(selector);
    const heading = content.find('div.space-y-4 > h1').text();
    const mainGroup = content.find('div.flex > div.w-full');
    const postedDate = mainGroup.find('p:contains("Posted ") > strong').text();
    const updatedDate = mainGroup.find('p:contains("Updated ") > strong').text();
    const tags = mainGroup
        .find('ul > li:contains("Tags :")')
        ?.nextAll('li')
        .toArray()
        .map((tag) => $$(tag).text());
    const shortArticles = mainGroup.find('[x-data^="{isShortArticleOpen"]');
    const sections = mainGroup.find('[x-data^="{isSectionOpen"]');
    if (shortArticles.length !== 0) {
        const items = shortArticles.toArray().map((element) => {
            const mainDiv = $$(element);
            const title = mainDiv.find('a > div > h1').text().trim();
            const id = mainDiv.find('a').attr('href');
            const htmlContent = extractArticle(mainDiv.html());
            const innerTags = mainDiv
                .find('ul > li:contains("Tags :")')
                ?.nextAll('li')
                .toArray()
                .map((tag) => $$(tag).text());
            const description = art(path.join(__dirname, `templates/description.art`), {
                heading: title,
                articleContent: htmlContent,
            });
            return {
                title: `${title} | ${heading}`,
                pubDate: parseDate(postedDate),
                category: innerTags,
                description,
                link: `${item.link}${id}`,
                author: 'Vision IAS',
            } as DataItem;
        });
        return items;
    } else if (sections.length === 0) {
        const htmlContent = extractArticle(mainGroup.html());
        const description = art(path.join(__dirname, 'templates/description.art'), {
            heading,
            articleContent: htmlContent,
        });
        return {
            title: item.title,
            pubDate: parseDate(postedDate),
            category: tags,
            description,
            link: item.link,
            updated: updatedDate ? parseDate(updatedDate) : null,
            author: 'Vision IAS',
        } as DataItem;
    } else {
        const items = sections.toArray().map((element) => {
            const mainDiv = $$(element);
            const title = mainDiv.find('a > div > h2').text().trim();
            const htmlContent = extractArticle(mainDiv.html(), 'div.ck-content');
            const description = art(path.join(__dirname, `templates/description-sub.art`), {
                heading: title,
                articleContent: htmlContent,
            });
            return { description };
        });
        const description = art(path.join(__dirname, `templates/description.art`), {
            heading,
            subItems: items,
        });
        return {
            title: heading,
            pubDate: parseDate(postedDate),
            category: tags,
            description,
            link: item.link,
            updated: updatedDate ? parseDate(updatedDate) : null,
            author: 'Vision IAS',
        } as DataItem;
    }
}

function extractArticle(articleDiv, selector: string = '#article-content') {
    const $ = load(articleDiv, null, false);
    const articleDiv$ = $(articleDiv);
    const articleContent = articleDiv$.find(selector);
    articleContent.find('figure').each((_, element) => {
        $(element).css('width', '');
    });
    const htmlContent = articleContent.html();
    return htmlContent;
}
