import createBrowserGetter from "get-puppeteer-browser";
import puppeteer from "puppeteer-core";
import findChrome from "chrome-finder";
import path from "path";
import fs from "fs-extra";
import sanitize from "sanitize-filename";
import scraper from "./scraper.js";
import { NodeHtmlMarkdown } from "node-html-markdown";
import logger from "./logger.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Browser {

    _browser

    /**
     *
     * @param fn
     * @returns {Promise<*>}
     */
    async withBrowser(opts) {
        /*const browser = await puppeteer.launch({
            headless         : true, //run false for dev
            Ignorehttpserrors: true, // ignore certificate error
            waitUntil        : 'networkidle2',
            defaultViewport  : {
                width : 1920,
                height: 1080
            },
            timeout          : 60e3,
            args             : [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '-- Disable XSS auditor', // close XSS auditor
                '--no-zygote',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '-- allow running secure content', // allow unsafe content
                '--disable-webgl',
                '--disable-popup-blocking',
                //'--proxy-server= http://127.0.0.1:8080 '// configure agent
            ],
            executablePath   : findChrome(),
        })*/

        const getBrowser = createBrowserGetter(puppeteer, {
            /*executablePath: findChrome(),
            headless      : false, // Set to false while development
            debounce      : 500,

            defaultViewport: null,
            args           : [
                '--no-sandbox',
                '--start-maximized', // Start in maximized state
            ],*/

            headless: opts.headless === 'yes' ? 'new' : false, //run false for dev memo
            Ignorehttpserrors: true, // ignore certificate error
            waitUntil: 'networkidle2',
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            // timeout: 60e3,
            protocolTimeout: 500e3,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '-- Disable XSS auditor', // close XSS auditor
                '--no-zygote',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '-- allow running secure content', // allow unsafe content
                '--disable-webgl',
                '--disable-popup-blocking',
                //'--proxy-server= http://127.0.0.1:8080 '// configure agent
            ],
            executablePath: findChrome(),
        })
        // this._browser = await getBrowser()
        const browser = await getBrowser();
        return browser
        /*try {
            return await fn(browser)
        } finally {
            await browser.close()
        }*/
    }

    async loginUser(opts) {
        // let p = new Puppy();
        const browser = await this.withBrowser(opts);
        await this.withPage(browser)(async (page) => {
            // logger.log('[Login] with Puppeteer as well in order to take images and etc');
            await page.goto("https://vueschool.io/login", {waitUntil: 'networkidle0'})//
            await this.login(page, opts)
            // await page.waitForTimeout(1e3);
        })
        return browser;
    }

    /**
     *
     * @param browser
     * @returns {(function(*): Promise<*|undefined>)|*}
     */
    withPage(browser) {
        return async fn => {
            const page = await browser.newPage()
            try {
                return await fn(page)
            } finally {
                await page.close()
            }
        }
    }

    /**
     *
     * @param page
     * @param opts
     * @returns {Promise<void>}
     */
    async checkForLogin(page, opts) {
        //
        // await page.waitForSelector('.lock-screen-wrapper', { timeout: 8e3 })//
        const elementExists = await page.$('.lock-screen-wrapper') !== null
        // logger.log('elementExists', elementExists, opts)
        if (elementExists) {
            //[...document.querySelectorAll('.lock-screen-wrapper a')].pop()
            await page.click(".lock-screen-wrapper a:last-child"); //where value is an attribute of the element input
            // await page.waitForSelector("text/Login")
            // await page.click("text/Login"); //where value is an attribute of the element input
            // await page.waitForTimeout(1000);
            // await page.$('.ctp-checkbox-label input[type="checkbox"]').click()
            await page.waitForSelector('#login_email', {timeout: 29e3})//
            await page.focus('input[type="email"]')
            await page.keyboard.type(opts.email)
            await page.focus('input[type="password"]')
            await page.keyboard.type(opts.password)
            await page.click('.btn-green-gradient')
            await page.waitForSelector('.vs-modal-overlay button', {timeout: 5e3})//
            await page.click('.vs-modal-overlay button')
            await this.delay(5e3)
            await page.waitForSelector('iframe', {timeout: 5e3})//
        }
    }

    async login(page, opts) {
        logger.log('[login] method begin');
        await page.waitForSelector('input[type="password"]', {timeout: 29e3})
        await page.focus('input[type="text"]')
        await page.keyboard.type(opts.email)
        await page.focus('input[type="password"]')
        await page.keyboard.type(opts.password)
        await page.click('.btn-green-gradient')
        await this.delay(2e3)
        logger.log('[login] method end');
    }

    /**
     *
     * @param browser
     * @param title
     * @param dest
     * @param url
     * @param opts
     * @returns {Promise<*|undefined>}
     */
    async makeScreenshot(browser, title, dest, url, opts) {
        title = sanitize(title);
        logger.log('[makeScreenshot] entering:', url, 'title:', title, 'dest:', dest);
        //add screenshot
        try {
            await fs.ensureDir(path.join(dest, 'screenshot'))

            return await this.withPage(browser)(async (page) => {
                await this.retry(async () => {
                    await page.goto(url)//, { waitUntil: 'networkidle0' }

                    await this.checkForLogin(page, opts)

                    await Promise.all([
                        (async () => {


                            /*const browserPage = await page.evaluate(() => location.href)
                            logger.debug(`[browserPage] ${browserPage}`);
                            //check if we are on profile page
                            if (browserPage.includes('/lessons/')) {
                                logger.warn('[warm browserPage] wait for comments:', browserPage)
                                //wait for comments to load
                                await page.waitForSelector('.comments', { timeout: 29e3 })
                                await this.delay(1e3)
                            }

                            //create a screenshot
                            const $sec = await page.$('body')
                            if (!$sec) throw new Error(`Parsing failed!`)
                            fs.ensureDir(dest)
                            // await $sec.screenshot({
                            //     path          : path.join(process.cwd(), dest, 'screenshot', `${title.replace('.mp4', '')}.png`),
                            //     type          : 'png',
                            //     omitBackground: true,
                            //     delay         : '500ms'
                            // })
                            await this.delay(1e3)
                            await page.screenshot({
                                path: path.join(dest, 'screenshot', `${title.replace('.mp4', '')}.png`),
                                // omitBackground: true,
                                fullPage: true,
                                timeout: 0
                            });
                            await this.delay(1e3)*/
                        })(),
                        (async () => {
                            if (opts?.html === 'yes') {
                                await this.delay(1e3)
                                const directory = path.join(dest, 'html', sanitize(`${title.replace('.mp4', '')}`))
                                logger.info('[makeScreenshot] directory::::', directory);
                                await scraper(opts, page, directory, {url})
                                await this.delay(1e3)
                            }
                        })(),
                        // await this.createHtmlPage(page, dest, title),
                        // await this.createMarkdownFromHtml(page, title, dest),
                        await this.createPdf(browser, page, dest, title)
                    ])

                    const browserPage = await page.evaluate(() => location.href)
                    logger.debug(`[browserPage] ${browserPage}`);
                    //check if we are on profile page
                    if (browserPage.includes('/lessons/')) {
                        logger.warn('[warm browserPage] wait for comments:', browserPage)
                        //wait for comments to load
                        await page.waitForSelector('.comments', { timeout: 29e3 })
                        await this.delay(1e3)
                    }

                    //check if there is popup before screenshot
                    const elementExists = await page.$('.onesignal-slidedown-dialog') !== null
                    // logger.log('elementExists', elementExists, opts)
                    if (elementExists) {
                        logger.info('[makeScreenshot] found popup onesignal-slidedown-dialog');
                        await page.click("#onesignal-slidedown-cancel-button");
                        await page.waitForTimeout(1e3);
                    }

                    //create a screenshot
                    const $sec = await page.$('body')
                    if (!$sec) throw new Error(`Parsing failed!`)
                    fs.ensureDir(dest)
                    await this.delay(2e3)
                    await page.screenshot({
                    // await $sec.screenshot({
                        path          : path.join(dest, 'screenshot', `${title.replace('.mp4', '')}.png`),
                        type          : 'png',
                        omitBackground: true,
                        delay         : '500ms',
                        fullPage      : true,
                    })

                   /* await page.screenshot({
                        path: path.join(dest, 'screenshot', `${title.replace('.mp4', '')}.png`),
                        // omitBackground: true,
                        fullPage: true,
                        timeout: 0
                    });*/
                    await this.delay(2e3)

                }, 6, 1e3, page, true);
            })


        } catch (err) {
            logger.error('error with course', title);
            logger.error('2err', err);
        }
    }

    async isHeadlessMode(browser) {
        // const u = await page.evaluate('navigator.userAgent');
        const ua = await browser.userAgent()
        // logger.log('UA::', ua, ua.toLowerCase().includes('headlesschrome'))
        return ua.toLowerCase().includes('headlesschrome')
    }

    async createPdf(browser, page, dest, title) {
        logger.debug(`[createPdf] start - ${title}`)
        /*if (!await this.isHeadlessMode(browser)) {
            logger.log('headless mode is set off!!!')
            return
        }*/
        await fs.ensureDir(path.join(dest, 'pdf'))
        await page.pdf({
            path: path.join(dest, 'pdf', sanitize(`${title.replace('.mp4', '')}.pdf`)),
            printBackground: true,
            // format         : "Letter",
            timeout: 60e3,
        });
        logger.debug(`[createPdf] end - ${title}`)
    }

    async createHtmlPage(page, dest, title) {
        await fs.ensureDir(path.join(dest, 'html'))
        //save html of a page
        const html = await page.content();
        await fs.writeFile(path.join(dest, 'html', sanitize(`${title.replace('.mp4', '')}.html`)), html);
        await this.delay(1e3)
    }

    async createMarkdownFromHtml(page, title, dest) {
        logger.info('[createMarkdownFromHtml] start')
        const nhm = new NodeHtmlMarkdown();
        // const title = title
        // let position = 0
        let markdown = await page.evaluate(() => Array.from(document.body.querySelectorAll(".bg-base-secondary > .bg-white"), txt => txt.outerHTML)[0]);
        //let html = await this._client._r({ url: course.http_url })
        // logger.log('markdown', markdown);
        if (!markdown) {
            logger.warn('-----------------nema markdown', title);
            //await this.createFullPageScreenshot(page, path.join(opts.dir, sanitize(course.title), 'error'), 0, title);
            throw new Error(`No Markdown found - ${title}`)
        }
        // logger.log('aaaa', path.join(dest, 'markdown'));
        await fs.ensureDir(path.join(dest, 'markdown'))
        await fs.writeFile(path.join(dest, 'markdown', sanitize(`${title.replace('.mp4', '')}.md`)), nhm.translate(markdown), 'utf8')
        await this.delay(1e3)
        logger.info('[createMarkdownFromHtml] end')
    }

    /**
     *
     * @param time
     * @returns {Promise}
     */
    delay(time) {
        return new Promise(resolve => {
            setTimeout(resolve, time)
        })
    }

    /**
     * Retries the given function until it succeeds given a number of retries and an interval between them. They are set
     * by default to retry 5 times with 1sec in between. There's also a flag to make the cooldown time exponential
     * @param {Function} fn - Returns a promise
     * @param {Number} retriesLeft - Number of retries. If -1 will keep retrying
     * @param {Number} interval - Millis between retries. If exponential set to true will be doubled each retry
     * @param page
     * @param {Boolean} exponential - Flag for exponential back-off mode
     * @return {Promise<*>}
     */
    async retry(fn, retriesLeft = 5, interval = 1000, page, exponential = false) {
        try {
            const val = await fn()
            return val
        } catch (error) {
            if (retriesLeft) {
                logger.warn('.... retrying left (' + retriesLeft + ')')
                logger.warn('retrying err', error)
                await fs.ensureDir(path.resolve(process.cwd(), 'errors'))
                await page.screenshot({
                    path: path.resolve(process.cwd(), `errors/${ new Date().toISOString() }.png`),
                    // path    : path.join(process., sanitize(`${String(position).padStart(2, '0')}-${title}-full.png`)),
                    fullPage: true
                });
                await new Promise(r => setTimeout(r, interval))
                return this.retry(fn, retriesLeft - 1, exponential ? interval * 2 : interval, page, exponential)
            } else {
                logger.error('Max retries reached')
                throw error
            }
        }
    }

}
