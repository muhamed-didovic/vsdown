const fs = require('fs-extra')
const Promise = require('bluebird');
const sanitize = require('sanitize-filename')
const path = require("path");
const cheerio = require("cheerio");

const { NodeHtmlMarkdown } = require('node-html-markdown');

const req = require('requestretry');
const downOverYoutubeDL = require("./helpers/downOverYoutubeDL");
// const Puppy = require("./helpers/browser");
const j = req.jar();
const request = req.defaults({ jar: j, retryDelay: 500, fullResponse: true });


module.exports = class Crawler {
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
        if (searchFromLocalFile && await fs.exists(path.resolve(process.cwd(), 'json/search-courses.json'))) {
            console.log('LOAD FROM LOCAL SEARCH FILE');
            return require(path.resolve(process.cwd(), 'json/search-courses.json'))
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
            'url'   : `https://vueschool.io/courses?filter=free-courses`
        };
        let { body } = await request(options)
        const $ = cheerio.load(body)
        const courses = $('.thumb-card')
            .map((index, course) => {
                return {
                    value: $(course).attr('href'),
                    title:  sanitize($(course).find('h3').text())
                }
            })
            .toArray()

        await fs.writeFile(`./json/search-courses.json`, JSON.stringify(courses, null, 2), 'utf8')
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

        if (post.statusCode === 302) {
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
            console.error(`ERROR REQUESt url: ${opts.url}`, e);
            return;
        }
    };

    /**
     *
     * @returns {bluebird<*>}
     * @param {*&{ms: Spinnies}} opts
     */
    async getAllCourses(opts) {
        const { ms, dir, concurrency } = opts;
        return Promise
            .resolve()
            .then(async () => {
                let { body } = await this._req({ url: `${this.url}/courses` })//?filter=free-courses
                const $ = cheerio.load(body)
                return $('.thumb-card')
                    .map((index, course) => {
                        return $(course).attr('href')
                    })
                    .toArray()
            })
            .then(async (courses) => {
                console.log('courses length:', courses.length);
                return await Promise
                    .map(courses, async (url, index) => {
                        // console.log('courseUrl', url);
                        return this.getSingleCourse({ url, ms, ...opts });
                    }, {
                        concurrency: 1//opts.concurrency
                    })
                    .then(c => c.flat())

            })
    }

    /**
     *
     * @param url
     * @param ms
     * @param dir
     * @param markdown
     * @param concurrency
     * @returns {bluebird<*>}
     */
    async getSingleCourse({ url, ms, dir, markdown, concurrency }) {
        ms.add('info', { text: `Get course: ${url}` });
        ms.add('markdown', { text: `Markdown started...` });

        return Promise
            .resolve()
            .then(async () => {
                //get the chapters or videos from requests
                let { body } = await this._req({ url })

                const $ = cheerio.load(body)
                // console.log('found chapters:', $('#chapters').find('.chapter').length);
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
            })
            .then(async (lessons) => {
                //https://vueschool.io/lessons/what-do-i-need-to-take-the-vue-3-masterclass
                //https://vueschool.io/api/lessons/what-do-i-need-to-take-the-vue-3-masterclass/widgetInfo
                // console.log('lllessons', lessons.slice(0, 1));
                // let p = new Puppy();
                // const browser = p.withBrowser();
                let i = 0;
                return await Promise
                    .map(lessons, async (lesson, index) => {
                        let { body } = await this._req({ url: lesson })
                        const $ = cheerio.load(body)

                        //find vimeo stuff
                        const vimeoData = $('vimeo-player');
                        // console.log('length', lesson, vimeoData.length);

                        //check if access is allowed to lesson
                        if (!vimeoData.length) {
                            return;
                        }

                        const [, res] = await Promise.all([
                            (async () => {
                                /* const apiUrl = lessons.slice(0, 1)[0].split('lessons/')[1]
                                 console.log('apiUrl', apiUrl);
                                 console.log('aaa', `https://vueschool.io/api/lessons/${apiUrl}/widgetInfo`);
                                 let json = await this._request({ url: `https://vueschool.io/api/lessons/${apiUrl}/widgetInfo` })
                                 return json;*/

                                //console.log($('vimeo-player').attr(':id'));
                                /*:id="505150486"
                                lesson_id="399"
                                lesson_title="What Do I Need to Take the Vue 3 Masterclass?"
                                course_id="18"
                                course_title="The Vue.js 3 Masterclass"
                                next_lesson_url="https://vueschool.io/lessons/install-vue-cli-and-its-dependencies"
                                previous_lesson_url=""
                               */
                                if (markdown === 'yes') {
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
                                        ms,
                                        dir,
                                        id    : vimeoData.attr('course_id'),
                                        title : vimeoData.attr('lesson_title'),
                                        series: {
                                            id   : vimeoData.attr('course_id'),
                                            title: vimeoData.attr('course_title'),
                                            slug : lesson
                                        },
                                        index
                                    });
                                    ms.update('markdown', { text: `Markdown building for ${vimeoData.attr('lesson_title')}.md` });
                                }

                                // if(screenshot) {
                                //     await p.makeScreenshot(browser, course, dest, lesson)
                                // }
                                // console.log('markdown is skipped');
                                return;

                            })(),
                            (async () => {
                                ms.update('info', { text: `Extracting ${++i}/${lessons.length} course: ${lesson}` });
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
                    .then(c => c.flat())
                    .then(c => c.filter(Boolean))

            })
            .then(async (courses) => {
                ms.succeed('markdown', { text: `Markdown is done...` });
                ms.succeed('info', { text: `Extraction is done for ${courses.length} videos from courses` });
                return courses;
            });
    }

    /**
     * @param markdown
     * @param ms
     * @param dir
     * @param course
     * @returns {bluebird<void>}
     */
    async createMarkdown({ markdown, ms, dir, id, series, title, index }) {
        const nhm = new NodeHtmlMarkdown();
        let seriesTitle = sanitize(series.title)
        let position = index + 1;//course.order
        let newTitle = sanitize(`${position}. ${title}.md`)
        let downPath = `${series.id}-${seriesTitle}`
        await fs.ensureDir(path.join(process.cwd(), dir, downPath, 'markdown'))
        await fs.writeFile(path.join(process.cwd(), dir, downPath, 'markdown', newTitle), nhm.translate(markdown), 'utf8')
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
        //console.log('course', course);
        // console.log('course.download', course.video.has_download, course.video.vimeo_id);
        let vimeoUrl = `https://player.vimeo.com/video/${course?.video?.vimeo_id}?h=441c7816f6&title=0&byline=0&portrait=0&app_id=122963`
        if (!course?.series?.title || !course?.video?.vimeo_id) {
            console.log('Issue with the course:', course.title)
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
            const { body, attempts } = await request({
                url        : vimeoUrl,
                maxAttempts: 50,
                headers    : {
                    'Referer'   : this.url,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36'
                }
            })

            v = this.findVideoUrl(body, '1080')
            // console.log('attempts', attempts);
            // console.log('v', v);
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
            console.log('ERROR with vimeoUrl:', vimeoUrl, 'vvvv:', v);
            console.log('ERR::', err);
            /*if (err.message === 'Received invalid status code: 404') {
                return Promise.resolve();
            }*/
            throw err;
        }
    };

    findVideoUrl(str, quality) {
        const regex = /(?:config = )(?:\{)(.*(\n.*?)*)(?:\"\})/gm;
        let res = regex.exec(str);
        if (res !== null) {
            if (typeof res[0] !== "undefined") {
                let config = res[0].replace('config = ', '');
                config = JSON.parse(config);
                /*let progressive = config.request.files.progressive, videoURL;
                for (let item of progressive) {
                    videoURL = item.url;
                    if (quality + 'p' === item.quality)
                        break;
                }*/
                let progressive = config.request.files.progressive;

                let videoURL = progressive.find(vid => vid.quality === quality + 'p')?.url;

                if (!videoURL) {
                    console.log('-----no 1080p video found', progressive);
                    //can't find 1080p quality let's see if there is 720p video
                    videoURL = progressive.find(vid => vid.quality === '720p')?.url;
                }

                return videoURL;
            }
        }
        return null;
    }

    async d(filename, prefix, courses, ms, opts) {
        const { logger, concurrency, file, filePath, overwrite } = opts

        await Promise.all([
            (async () => {
                if (!file) {
                    logger.info(`${prefix} - Starting writing to a file ...`)
                    fs.ensureDir(path.resolve(process.cwd(), 'json'));
                    await fs.writeFile(`./json/${filename}`, JSON.stringify(courses, null, 2), 'utf8')
                    logger.info(`${prefix} - Ended writing to a file ...`)
                    return Promise.resolve()
                }
                logger.info(`${prefix} - file is used`)
                return Promise.resolve()

            })(),
            (async () => {
                let cnt = 0
                logger.info(`Starting download with concurrency: ${concurrency} ...`)
                // console.log('courses', courses);
                await Promise.map(courses, async (course, index) => {
                    if (course.done) {
                        console.log('DONE for:', course.title);
                        cnt++
                        return;
                    }
                    /*if (!course.vimeoUrl) {
                        throw new Error('Vimeo URL is not found')
                    }*/
                    const dest = path.join(opts.dir, course.downPath)
                    fs.ensureDir(dest)

                    //const details = await this._vimeoRequest(course)
                    const details = {
                        url : course.vimeoUrl,
                        size: -1
                    }

                    await downOverYoutubeDL(details, path.join(dest, course.title), {
                        downFolder: dest,
                        index,
                        ms,
                        overwrite
                    })

                    if (file) {
                        courses[index].done = true;
                        await fs.writeFile(filePath, JSON.stringify(courses, null, 2), 'utf8');
                    }
                    cnt++
                }, {
                    concurrency// : 1
                })
                ms.stopAll('succeed');
                logger.succeed(`Downloaded all videos for '${prefix}' api! (total: ${cnt})`)
            })()
        ])
    }
}

