const createBrowserGetter = require("get-puppeteer-browser");
const puppeteer = require("puppeteer-core");
const findChrome = require("chrome-finder");
const path = require("path");
const fs = require('fs-extra')
const sanitize = require("sanitize-filename");

module.exports = class Browser {

    _browser

    /**
     *
     * @param fn
     * @returns {Promise<*>}
     */
    async withBrowser() {
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

            headless         : true, //run false for dev memo
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

    async makeScreenshot(browser, title, dest, url) {
        title = sanitize(title);
        // console.log('makeScreenshot', {title, dest, url});
        //add screenshot
        try {
            await fs.ensureDir(path.join(dest, 'screenshot'))

            return await this.withPage(browser)(async (page) => {
                await this.retry(async () => {
                    await page.goto(url)//, { waitUntil: 'networkidle0' }

                    const $sec = await page.$('body')
                    if (!$sec) throw new Error(`Parsing failed!`)

                    await this.createHtmlPage(page, dest, title);
                    await this.createPdf(browser, page, dest, title);
                    // if (a === 'course page') {
                    //     await this.createMarkdownFromHtml(page, course, dest)
                    // }
                    fs.ensureDir(dest)
                    // await $sec.screenshot({
                    //     path          : path.join(process.cwd(), dest, 'screenshot', `${title.replace('.mp4', '')}.png`),
                    //     type          : 'png',
                    //     omitBackground: true,
                    //     delay         : '500ms'
                    // })
                    await page.screenshot({
                        path          : path.join(dest, 'screenshot', `${title.replace('.mp4', '')}.png`),
                        omitBackground: true,
                        fullPage      : true
                    });
                }, 6, 1e3, page, true);
            })


            // })

        } catch (err) {
            console.log('error with course', title);
            console.log('2err', err);
        }
    }

    async isHeadlessMode(browser) {
        // const u = await page.evaluate('navigator.userAgent');
        const ua = await browser.userAgent()
        // console.log('UA::', ua, ua.toLowerCase().includes('headlesschrome'))
        return ua.toLowerCase().includes('headlesschrome')
    }

    async createPdf(browser, page, dest, title) {
        if (!await this.isHeadlessMode(browser)) {
            console.log('headless mode is set off!!!')
            return
        }
        await fs.ensureDir(path.join(dest, 'pdf'))
        await page.pdf({
            path           : path.join(dest, 'pdf', sanitize(`${title.replace('.mp4', '')}.pdf`)),
            printBackground: true,
            // format         : "Letter",
            timeout: 60e3,
        });
    }

    async createHtmlPage(page, dest, title) {
        await fs.ensureDir(path.join(dest, 'html'))
        //save html of a page
        const html = await page.content();
        await fs.writeFile(path.join(dest, 'html', sanitize(`${title.replace('.mp4', '')}.html`)), html);
        await this.delay(1e3)
    }

    async createMarkdownFromHtml(page, course, dest) {
        const nhm = new NodeHtmlMarkdown();
        const title = title
        let position = 0
        let markdown = await page.evaluate(() => Array.from(document.body.querySelectorAll(".bg-base-secondary > .bg-white"), txt => txt.outerHTML)[0]);
        //let html = await this._client._r({ url: course.http_url })
        // console.log('markdown', markdown);
        if (!markdown) {
            console.log('-----------------nema markdown', title);
            //await this.createFullPageScreenshot(page, path.join(opts.dir, sanitize(course.title), 'error'), 0, title);
            throw new Error(`No Markdown found - ${title}\``)
        }
        // console.log('aaaa', path.join(dest, 'markdown'));
        await fs.ensureDir(path.join(dest, 'markdown'))
        await fs.writeFile(path.join(dest, 'markdown', sanitize(`${title.replace('.mp4', '')}.md`)), nhm.translate(markdown), 'utf8')
        await this.delay(1e3)
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
                console.log('.... retrying left (' + retriesLeft + ')')
                console.log('retrying err', error)
                await fs.ensureDir(path.resolve(process.cwd(), 'errors'))
                await page.screenshot({
                    path: path.resolve(process.cwd(), `errors/${new Date().toISOString().replace(/:/g , "-")}.png`),
                    // path    : path.join(process., sanitize(`${String(position).padStart(2, '0')}-${title}-full.png`)),
                    fullPage: true
                });
                await new Promise(r => setTimeout(r, interval))
                return this.retry(fn, retriesLeft - 1, exponential ? interval*2 : interval, page, exponential)
            } else {
                console.log('Max retries reached')
                throw error
            }
        }
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

}