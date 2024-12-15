import cache from '@/utils/cache';
import { config } from '@/config';
import puppeteer from '@/utils/puppeteer';
import { getCookies, setCookies } from '@/utils/puppeteer-utils';

export const parseToken = (link: string) =>
    cache.tryGet(
        'xueqiu:token',
        async () => {
            const page = await getPuppeteerPage();
            await page.goto(link, {
                waitUntil: 'domcontentloaded',
            });
            await page.evaluate(() => document.documentElement.innerHTML);
            const cookies = await getCookies(page);

            return cookies;
        },
        config.cache.routeExpire,
        false
    );

export const getPuppeteerPage = async () => {
    const browser = await puppeteer({ stealth: true });
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.resourceType() === 'document' ? request.continue() : request.abort();
    });

    return page;
};

export const getJson = async (url: string, cookie: string | Record<string, any> | null = null) => {
    const page = await getPuppeteerPage();

    if (cookie) {
        await setCookies(page, cookie, 'xueqiu.com');
    }

    const data = await page.goto(url, {
        waitUntil: 'domcontentloaded',
    });

    const res = await data?.json();
    return res;
};
