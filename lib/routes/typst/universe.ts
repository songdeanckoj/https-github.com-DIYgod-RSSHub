import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';
import markdownit from 'markdown-it';
import { Token, Options, Renderer } from 'markdown-it/index.js';
import vm from 'node:vm';

interface Package {
    name: string;
    version: string;
    entrypoint: string;
    authors: Array<string>;
    license: string;
    description: string;
    repository: string;
    keywords: Array<string>;
    compiler: string;
    exclude: Array<string>;
    size: number;
    readme: string;
    updatedAt: number;
    releasedAt: number;
}

interface Context {
    an: { exports: Array<Package> };
}

const GITHUBRAW_BASE = 'https://raw.githubusercontent.com';
const PKG_GITHUB_BASE = `${GITHUBRAW_BASE}/typst/packages/main/packages/preview`;

function fixImageSrc(src, env) {
    if (src.indexOf('://') > 0) {
        if (src.startsWith('https://typst.app/universe/package')) {
            src = src.replaceAll('https://typst.app/universe/package', `${PKG_GITHUB_BASE}/${env.name}/${env.version}`);
        } else if (src.startsWith('https://github.com')) {
            src = src.replace('https://github.com', GITHUBRAW_BASE);
        }
    } else {
        const suffix = src.indexOf('/') === 0 ? '' : '/';
        const package_base = `${PKG_GITHUB_BASE}/${env.name}/${env.version}${suffix}`;
        const url = new URL(src, package_base);
        src = url.toString();
    }
    return src;
}

function rendererImage(tokens: Token[], idx: number, options: Options, env: Package, self: Renderer): string {
    const token = tokens[idx];
    if (token.attrs === null) {
        return '';
    }
    const src = token.attrGet('src');
    if (src === null) {
        return '';
    }
    token.attrs[token.attrIndex('src')][1] = fixImageSrc(src, env);
    return self.renderToken(tokens, idx, options);
}

function rendererHtmlImage(tokens: Token[], idx: number, _: Options, env: Package): string {
    const token = tokens[idx];
    const $ = load(token.content, {}, false);
    $('img').each((i, el) => {
        const src = el.attribs.src;
        el.attribs.src = fixImageSrc(src, env);
    });
    return $.html();
}

export const route: Route = {
    path: '/universe',
    categories: ['program-update'],
    example: '/typst/universe',
    radar: [
        {
            source: ['typst.app/universe'],
            target: '/universe',
        },
    ],
    name: 'Universe',
    maintainers: ['HPDell'],
    handler: async () => {
        const targetUrl = 'https://typst.app/universe/search?kind=packages%2Ctemplates&packages=last-updated';
        const page = await ofetch(targetUrl);
        const $ = load(page);
        const script = $('script')
            .toArray()
            .map((item) => item.attribs.src)
            .find((item) => item && item.startsWith('/scripts/universe-search'));
        const data: string = await ofetch(`https://typst.app${script}`, {
            parseResponse: (txt) => txt,
        });
        let packages = data.match(/(an.exports=[\S\s]+);var ([$A-Z_a-z][\w$]*)=new Intl.Collator/)?.[1];
        if (packages) {
            packages = packages.slice(0, -2);
            const context: Context = { an: { exports: [] } };
            vm.createContext(context);
            vm.runInContext(packages, context, {
                displayErrors: true,
            });
            const md = markdownit('commonmark');
            md.renderer.rules.image = rendererImage;
            md.renderer.rules.html_inline = rendererHtmlImage;
            md.renderer.rules.html_block = rendererHtmlImage;
            const items = context.an.exports.sort((a, b) => a.updatedAt - b.updatedAt);
            const groups = new Map(items.map((it) => [it.name, it]));
            const pkgs = [...groups.values()].map((item) => ({
                title: `${item.name} (${item.version}) | ${item.description}`,
                link: `https://typst.app/universe/package/${item.name}`,
                description: md.render(item.readme, item),
                pubDate: parseDate(item.updatedAt, 'X'),
            }));
            return {
                title: 'Typst universe',
                link: targetUrl,
                item: pkgs,
            };
        } else {
            return {
                title: 'Typst universe',
                link: targetUrl,
                item: [],
            };
        }
    },
};
