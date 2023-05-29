import fs from "fs-extra";
import sanitize from "sanitize-filename";
import path from "path";
import ufs from "url-file-size";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin())

import * as cheerio from 'cheerio';
import { differenceBy, orderBy } from "lodash-es";
import { NodeHtmlMarkdown } from 'node-html-markdown'

import findChrome from "chrome-finder";

import Spinnies from "dreidels";
const ms = new Spinnies()

import req from "requestretry";
import { fileURLToPath } from "url";
const j = req.jar()
const request = req.defaults({
    jar: j,
    retryDelay: 500,
    fullResponse: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36'
        // 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.119 Safari/537.36',

    }
})
import logger from "./helpers/logger.js";
import imgs2pdf from "./helpers/imgs2pdf.js";
import retry from "./helpers/retry.js";
import downOverYoutubeDL from "./helpers/downOverYoutubeDL.js";
import { series, downloaded } from './helpers/search.cjs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Crawler {
    url = "https://vueschool.io"
    version = ''
    _reg = ''

    /**
     * @param version
     */
    constructor(version = 'noop') {
        this.version = version
        this._req = request
    }

    static async getCourses(searchFromLocalFile) {
        // if (!body?.hits.length) {
        if (searchFromLocalFile && await fs.exists(path.resolve(__dirname, `../json/search-courses.json`))) {
            logger.log('LOAD FROM LOCAL SEARCH FILE');
            return require(path.resolve(__dirname, `../json/search-courses.json`))
        }

        //leave algolia for now
        /*const options = {
            //json     : true,
            'method': 'POST',
            'url'   : 'https://1ngizu78ob-3.algolianet.com/1/indexes/!*!/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.2.0)%3B%20Browser%20(lite)%3B%20instantsearch.js%20(3.7.0)%3B%20Vue%20(2.6.11)%3B%20Vue%20InstantSearch%20(2.7.0)%3B%20JS%20Helper%20(2.28.1)&x-algolia-api-key=NzhjM2Q0M2NmOGI1OWY5MGJjMWFjZmE5MTcwMjBlYmIyMjZjMWE1MjlhNWNmM2MwYjRiMzM2MGEwMzI2OTI0NHJlc3RyaWN0SW5kaWNlcz1wcm9kdWN0aW9uX3Z1ZXNjaG9vbCZ2YWxpZFVudGlsPTE2NTA4OTgyNDQ%3D&x-algolia-application-id=1NGIZU78OB',

            body: JSON.stringify({
                "requests":
                    [
                        {
                            "indexName": "production_vueschool",
                            "params"   : "query=&hitsPerPage=741&page=0&highlightPreTag=__ais-highlight__&highlightPostTag=__%2Fais-highlight__&facets=%5B%5D&tagFilters="
                        }
                    ]
            })

        };
        let { body } = await request(options)*/

        const options = {
            'url': `https://vueschool.io/courses?filter=free-courses`
        };
        let { body } = await request(options)
        const $ = cheerio.load(body)
        const courses = $('.thumb-card')
            .map((index, course) => {
                return {
                    value: $(course).attr('href'),
                    title: sanitize($(course).find('h3').text())
                }
            })
            .toArray()

        await fs.writeFile(path.resolve(__dirname, '../json/search-courses.json'), JSON.stringify(courses, null, 2), 'utf8')
        return courses;
    }

    async getCsrfToken() {
        const { body } = await this._req(`https://vueschool.io/login`)
        const [, csrfToken] = /<meta name="csrf-token" content="(.*)">/.exec(body)
        return csrfToken
    }

    /**
     *
     * @param opts
     * @returns {bluebird<Crawler>}
     */
    async login(opts) {
        const post = await this._req.post(`${this.url}/login`, {
            throwHttpErrors: false,
            followRedirect : true,
            // form          : true,
            headers: {
                'content-type': 'application/json',
                'X-CSRF-TOKEN': await this.getCsrfToken()
            },
            body   : JSON.stringify({
                email   : opts.email,
                password: opts.password
            })

        })
        const regex = /<title>Redirecting to https:\/\/vueschool.io<\/title>/gm
        let res = regex.exec(post.body);
        // logger.log('res', res);
        if (res) {//post.statusCode === 302
            return this;
        } else {
            throw new Error('User is not logged')
        }
    }

    /**
     * @param {any} opts
     */
    async _request(opts) {

        try {
            let { body } = await this._req({
                // jar: j,
                json: true,
                ...opts
            })

            return body;
        } catch (e) {
            logger.error(`ERROR REQUESt url: ${opts.url}`, e);
            return;
        }
    };

    /**
     *
     * @returns {bluebird<*>}
     * @param {*&{ms: Spinnies}} opts
     */
    async getAllCourses(opts) {
        const { p, ms, dir, concurrency, browser } = opts;
        return Promise
            .resolve()
            .then(async () => {
                let { body } = await this._req({ url: `${this.url}/courses${(opts.free === 'yes' ? '?filter=free-courses' : '')}` })//
                const $ = cheerio.load(body)
                return $('.thumb-card')
                    .map((index, course) => {
                        return {
                            value: $(course).attr('href'),
                            url: $(course).attr('href'),
                            title: sanitize($(course).find('h3').text())
                        }
                    })
                    .toArray()
            })
            .then(async (courses) => {
                //filter out downloaded courses
                let links = courses//require(path.join(__dirname, '../json/search-courses.json'))
                logger.debug('Total number of courses found:', links.length);//, links
                //remove courses that are downloaded already
                if (await fs.exists(path.join(__dirname, '../json/downloaded-courses.json'))) {
                    const downloadedCourses = downloaded;//await require(path.join(__dirname, '../json/downloaded-courses.json'))
                    links = differenceBy(links, downloadedCourses, 'url')
                    logger.debug('Remaining courses to be downloaded:', links.length);
                }

                // const c = ['https://vueschool.io/courses/accessible-sites-with-vue-js-3-a11y']
                logger.log('courses left:', links.length);
                return await Promise
                    .map(links, async (course) => {//.slice(0, 2)
                        logger.info('SCRAPING COURSE:', course.url);
                        const lessons = await this.getSingleCourse({ p, browser, url: course.url, ms, ...opts });
                        if (!lessons.length) {
                            logger.log(`Found not any videos for url: ${course.url}, download skipping... `);
                            return lessons;
                        }
                        logger.log(`Found ${lessons[0].series} course that has ${lessons.length} lessons`);
                        const prefix = 'courses'
                        const filename = `${prefix}-${lessons[0].series}-${new Date().toISOString().replace(/:/g, "-")}.json`
                        await this.d(filename, prefix, lessons, ms, opts);

                        if (await fs.exists(path.join(__dirname, '../json/downloaded-courses.json'))) {
                            logger.debug('add course as downloaded', course);
                            const downloadedCourses = downloaded;//require(path.join(__dirname, '../json/downloaded-courses.json'))
                            const foundCourse = downloadedCourses.find(({ url }) => course.url.includes(url))
                            logger.debug('course is found:', foundCourse);
                            if (!foundCourse) {
                                downloadedCourses.push(course);
                                await fs.writeFile(path.join(__dirname, `../json/downloaded-courses.json`), JSON.stringify(downloadedCourses, null, 2), 'utf8')
                            }
                        } else {
                            await fs.writeFile(path.join(__dirname, '../json/downloaded-courses.json'), JSON.stringify([course], null, 2), 'utf8')
                        }

                        return lessons;
                    }, {
                        concurrency: 1//opts.concurrency
                    })
                    .then(c => c.flat())
            })
    }

    /**
     *
     * @returns {bluebird<*>}
     * @param opts
     */
    async getSingleCourse(opts) {
        const { p, browser, url, ms, dir, markdown, concurrency } = opts
        ms.add('info', { text: `Get course: ${url}` });
        if (markdown === 'yes') {
            ms.add('markdown', { text: `Markdown started...` });
        }
        /*let p = new Puppy();
        const browser = await p.withBrowser();
        await p.withPage(browser)(async (page)  => {
            logger.log('CHECK FOR LOGIN');
            await page.goto("https://vueschool.io/courses/vue-3-single-file-components")//, { waitUntil: 'networkidle0' }
            await p.checkForLogin(page, email, password)
        })*/
        return Promise
            .resolve()
            .then(async () => {
                let { body } = await this._req({ url })

                // const regex = /(?:config = )(?:\{)(.*(\n.*?)*)(?:\"\})/gm;
                // const regex = /(?:mixpanelEvents)(?:\[)(.*(\n.*?)*)\]/gm;
                //     const [,bb] = /(?:mixpanelEvents)(.*)]/.exec(body)
                let [, proCourses] = /(?:mixpanelEvents: \[)(.*)]/.exec(body)
                //{"event":"Page Viewed","properties":{"page_name":"Course","course":"Vue.js 3 Fundamentals with the Composition API","course_id":42}}
                proCourses = JSON.parse(proCourses);
                // logger.log('2proCourses', proCourses);
                const [, lessons] = await Promise.all([
                    (async () => {

                        /*{
                            event: 'Page Viewed',
                                properties: {
                                    page_name: 'Course',
                                    course: 'Vue.js 3 Fundamentals with the Composition API',
                                    course_id: 42
                            }
                        }*/
                        let downPath = `${proCourses.properties.course_id}-${sanitize(proCourses.properties.course)}`
                        const dest = path.join(dir, downPath)
                        fs.ensureDir(dest)
                        await p.makeScreenshot(browser, `0. ${sanitize(proCourses.properties.course)}`, dest, url, opts)
                        return Promise.resolve();
                    })(),
                    (async () => {
                        const $ = cheerio.load(body)

                        // logger.log('found chapters:', $('#chapters').find('.chapter').length);
                        //get the chapters or videos from requests
                        const lessons = $('#chapters')
                            .find('.chapter')
                            .map((i, chapter) => {
                                return $(chapter)
                                    .find('.lesson')
                                    .map((index, lesson) => {
                                        return $(lesson).find('a').attr('href')
                                    })
                                    .toArray()
                            })
                            .toArray()
                        return lessons;
                    })(),
                ])
                return lessons;
            })
            .then(async (lessons) => {
                if (!lessons.length) {
                    throw new Error('No lessons found!!!')
                }

                //return [];
                //https://vueschool.io/lessons/what-do-i-need-to-take-the-vue-3-masterclass
                //https://vueschool.io/api/lessons/what-do-i-need-to-take-the-vue-3-masterclass/widgetInfo
                // logger.log('lllessons', lessons.slice(0, 1));

                let i = 0;
                return await Promise
                    .map(lessons, async (lesson, index) => {
                        let { body } = await this._req({ url: lesson })
                        const $ = cheerio.load(body)

                        //find vimeo stuff
                        const vimeoData = $('vimeo-player');
                        logger.log('vimeoData length:', lesson, vimeoData.length);

                        //check if access is allowed to lesson
                        if (!vimeoData.length) {
                            logger.error(`no video or access for: ${lesson.url}`);
                            return;
                        }

                        const [, res] = await Promise.all([
                            (async () => {
                                /* const apiUrl = lessons.slice(0, 1)[0].split('lessons/')[1]
                                 logger.log('apiUrl', apiUrl);
                                 logger.log('aaa', `https://vueschool.io/api/lessons/${apiUrl}/widgetInfo`);
                                 let json = await this._request({ url: `https://vueschool.io/api/lessons/${apiUrl}/widgetInfo` })
                                 return json;*/

                                //logger.log($('vimeo-player').attr(':id'));
                                /*:id="505150486"
                                lesson_id="399"
                                lesson_title="What Do I Need to Take the Vue 3 Masterclass?"
                                course_id="18"
                                course_title="The Vue.js 3 Masterclass"
                                next_lesson_url="https://vueschool.io/lessons/install-vue-cli-and-its-dependencies"
                                previous_lesson_url=""
                               */
                                if (markdown === 'yes') {
                                    logger.debug('[Markdown] start')
                                    //remove Discussion part
                                    $('.container .hidden').remove();
                                    //find necessary markdown
                                    let markdownOption = $('.container').find('.w-full.flex-no-grow').html()
                                    //add source code if found
                                    const sourceCode = $('aside .flex').find('a').attr('href')
                                    if (sourceCode) {
                                        markdownOption += `
                                        <h1>Source code</h1>
                                        <a href="${sourceCode}">Download source code</a>`
                                    }
                                    await this.createMarkdown({
                                        markdown: markdownOption,
                                        dir,
                                        // id      : vimeoData.attr('course_id'),
                                        title   : vimeoData.attr('lesson_title'),
                                        series  : {
                                            id   : vimeoData.attr('course_id'),
                                            title: vimeoData.attr('course_title'),
                                            slug : lesson
                                        },
                                        index
                                    });
                                    ms.update('markdown', { text: `Markdown building for ${vimeoData.attr('lesson_title')}.md` });
                                    logger.debug('[Markdown] end')
                                }

                                // if(screenshot) {
                                let downPath = `${vimeoData.attr('course_id')}-${sanitize(vimeoData.attr('course_title'))}`
                                const dest = path.join(dir, downPath)
                                fs.ensureDir(dest)
                                await p.makeScreenshot(browser, `${index + 1}. ${sanitize(vimeoData.attr('lesson_title'))}`, dest, lesson, opts)
                                // }
                                // logger.log('markdown is skipped');
                                return;

                            })(),
                            (async () => {
                                ms.update('info', { text: `Extracting ${++i}/${lessons.length} lesson: ${lesson}` });
                                return this.extractVideos({
                                    course: {
                                        video : {
                                            vimeo_id: vimeoData.attr(':id')
                                        },
                                        title : vimeoData.attr('lesson_title'),
                                        series: {
                                            id   : vimeoData.attr('course_id'),
                                            title: vimeoData.attr('course_title'),
                                            slug : lesson
                                        },
                                    },
                                    ms,
                                    index,
                                    total : 0
                                });

                            })(),
                        ])


                        return res;
                    }, {
                        concurrency
                    })
                    .then(c => c.filter(Boolean))
                    .then(async c => {
                        // logger.log('1----------------------------------------------------------------', url, c[0].downPath);
                        // await browser.close()
                        let dest = path.join(dir, c[0].downPath)
                        await fs.ensureDir(dest)
                        await imgs2pdf(
                            path.join(dest, 'screenshot'),
                            path.join(dest, 'screenshot', `${c[0].series}.pdf`)
                        )
                        return c.flat()
                    })
                // .then(c => c.filter(Boolean))

            })
            .then(async (courses) => {
                ms.succeed('info', { text: `Extraction is done for ${courses.length} videos from courses` });
                return courses;
            })
            .catch(err => {
                if (err.message === 'No lessons found!!!') {
                    logger.error('------>No lessons found for:', url);
                    ms.succeed('info', { text: `No lessons found` });
                    return []
                }
                logger.error('------>eeee', err.message);
                throw err;
            })
            .finally(async () => {
                if (markdown === 'yes') {
                    ms.succeed('markdown', { text: `Markdown is done...` });
                }
                // await browser.close()
            })
    }

    /**
     * @param markdown
     * @param ms
     * @param dir
     * @returns {bluebird<void>}
     */
    async createMarkdown({ markdown, dir, series, title, index }) {
        logger.log(`[createMarkdown] start - ${title}`)
        const nhm = new NodeHtmlMarkdown();
        let position = index + 1;//course.order
        let newTitle = sanitize(`${position}. ${title}.md`)
        let downPath = `${series.id}-${sanitize(series.title)}`
        await fs.ensureDir(path.join(dir, downPath, 'markdown'))
        await fs.writeFile(path.join(dir, downPath, 'markdown', newTitle), nhm.translate(markdown), 'utf8')
        logger.log(`[createMarkdown] end - ${title}`)
    }

    /**
     *
     * @param course
     * @param ms
     * @param index
     * @param total
     * @returns {bluebird<{series: string, downPath: string, position: number | string, title: string, url: string}>}
     */
    extractVideos({ course, ms, index, total }) {
        //logger.log('course', course);
        // logger.log('course.download', course.video.has_download, course.video.vimeo_id);
        let vimeoUrl = `https://player.vimeo.com/video/${course?.video?.vimeo_id}?h=441c7816f6&title=0&byline=0&portrait=0&app_id=122963`
        if (!course?.series?.title || !course?.video?.vimeo_id) {
            logger.log('Issue with the course:', course.title)
        }
        let series = sanitize(course.series.title)
        let position = index + 1;//course.order
        // let title = sanitize(`${position}. ${course.title}.mp4`)
        let title = sanitize(`${position}. ${course.title}.mp4`)
        let downPath = `${course.series.id}-${series}`

        return {
            series,
            //...(course.video.has_download && { url }),
            title,
            position,
            downPath,
            vimeoUrl
        }
    }

    /**
     *
     * @param course
     * @returns <string> url
     * @private
     */
    async _vimeoRequest(course) {
        const vimeoUrl = course.vimeoUrl
        let v;
        try {
            const v = await retry(async () => {//return
                const { body, attempts } = await request({
                    url        : vimeoUrl,
                    maxAttempts: 50,
                    headers    : {
                        'Referer'   : this.url,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36'
                    }
                })
                if (body.includes('408 Request Time-out')) {
                    logger.log('408 error:', vimeoUrl, body);
                    throw new Error('408 ERRROR')
                }

                return this.findVideoUrl(body, course)

            }, 6, 1e3, true)
            // logger.log('v', v, 'vimeoUrl',vimeoUrl);
            if (!v) {
                return {
                    size: -1,
                    url : vimeoUrl
                }
            }

            // missing logic for direct url download, check this when url is available
            const { headers, attempts: a } = await request({
                url         : v,
                json        : true,
                maxAttempts : 50,
                method      : "HEAD",
                fullResponse: true, // (default) To resolve the promise with the full response or just the body
                'headers'   : {
                    'Referer': this.url,
                }
            })

            return {
                url : v,
                size: headers['content-length']
            };
        } catch (err) {
            logger.log('ERROR with vimeoUrl:', vimeoUrl, 'vvvv:', v);
            logger.log('ERR::', err);
            /*if (err.message === 'Received invalid status code: 404') {
                return Promise.resolve();
            }*/
            throw err;
        }
    };

    findVideoUrl(str, course) {
        const regex = /(?:\bconfig|window\.playerConfig)\s*=\s*({.+?};?\s*var)/ // /playerConfig = {(.*)}; var/gm
        let res = regex.exec(str);
        let configParsed;
        if (res !== null && typeof res[0] !== "undefined") {
            try {
                // logger.log('res', res[1]);
                configParsed = res[1]
                    .trim()
                    .replace(/(\r\n|\n|\r)/gm, "")
                    // .replace('var', '')
                    .replace(/(;?\s*var)/g, '')
                    .trim()
                    .replace(/(;\s*$)/g, "");
                // configParsed = configParsed.replace(/(; var\s*$)/g, '');
                // configParsed = configParsed.replace(/(;\s*$)/g, '');
                // logger.log('---', configParsed);
                configParsed = JSON.parse(`${configParsed}`);
                let progressive = configParsed.request.files.progressive;

                if (!progressive.length) {
                    // logger.log('Noooooooooooooooooooooooooooooooooooooooooooooooo', course.title, course.vimeoUrl);
                    return null;
                }

                // logger.log('progressive', url, progressive);
                let video = orderBy(progressive, ['width'], ['desc'])[0];
                // logger.log('video', video);
                return video.url;
            } catch (err) {
                logger.warn('error with findVideoUrl:', course.title, course.vimeoUrl, '-->err:', err);
                logger.warn('json config:', configParsed);
                logger.warn('res:', res[1]);
                // fs.writeFileSync(path.join('./json', `${url}.md`), str, 'utf8')//-${Date.now()}

                fs.writeFileSync(path.resolve(__dirname, `../json/${course.title}.md`), JSON.stringify(str, null, 2), 'utf8')
                // fs.writeFileSync(`./json/test.txt`, res, 'utf8')
                logger.error('Error with vimeo stuff:', err);
                throw err;
            }

        }
        logger.log('NO VIDEO FOUND:', url);
        // fs.writeFileSync(`./json/no-config-found-${Date.now()}.txt`, str, 'utf8')
        return null;
    }

    async d(filename, prefix, courses, ms, opts) {
        const { concurrency, file, filePath, overwrite, dir } = opts

        await Promise
            .all([
                (async () => {
                    if (file === 'no') {
                        logger.info(`${prefix} - Starting writing to a file ...`)
                        fs.ensureDir(path.join(__dirname, '../json'));

                        await fs.writeFile(path.resolve(__dirname, `../json/${filename}`), JSON.stringify(courses, null, 2), 'utf8')
                        logger.info(`${prefix} - Ended writing to a file ...`)
                        //return Promise.resolve()
                    }
                    logger.info(`${prefix} - file is used`)
                    //return Promise.resolve()

                })(),
                (async () => {
                    let cnt = 0
                    logger.info(`Starting download with concurrency: ${concurrency} ...`)
                    // logger.log('courses', courses);
                    await Promise.map(courses, async (course, index) => {
                        if (course.done) {
                            logger.log('DONE for:', course.title);
                            cnt++
                            return;
                        }
                        /*if (!course.vimeoUrl) {
                            throw new Error('Vimeo URL is not found')
                        }*/
                        const dest = path.join(opts.dir, course.downPath)
                        fs.ensureDir(dest)

                        const details = await this._vimeoRequest(course)
                        // const details = {
                        //     url : course.vimeoUrl,
                        //     size: -1
                        // }

                        await downOverYoutubeDL(details, path.join(dest, course.title), {
                            downFolder: dest,
                            index,
                            ms,
                            overwrite
                        })

                        if (file === 'yes') {
                            courses[index].done = true;
                            await fs.writeFile(filePath, JSON.stringify(courses, null, 2), 'utf8');
                        }
                        cnt++
                    }, {
                        concurrency// : 1
                    })
                    ms.stopAll('succeed');
                    // logger.succeed(`Downloaded all videos for '${prefix}' api! (total: ${cnt})`)
                    logger.info(`Downloaded course (total lessons: ${cnt})`)
                })()
            ])
    }
}

