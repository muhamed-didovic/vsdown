import createLogger from "./helpers/createLogger.js";
import Crawler from "./Crawler.js";
import Puppy from "./helpers/browser.js";
import logger from "./helpers/logger.js";
import Spinnies from "dreidels";
const ms = new Spinnies()

export const all = async (opts = {}) => {
    opts = normalizeOpts(opts)
    logger.log('opts', opts);
    const { oraLogger, file, filePath } = opts

    // login
    let crawler = new Crawler()
    crawler = await oraLogger.promise(crawler.login(opts), 'Login...')
    let p = new Puppy();
    let browser = await p.loginUser(opts);

    /*const browser = await p.withBrowser();
    await p.withPage(browser)(async (page)  => {
        logger.log('CHECK FOR LOGIN');
        await page.goto("https://vueschool.io/login",{ waitUntil: 'networkidle0' })//
        await p.login(page, opts)
        await page.waitForTimeout(1e3);
    })*/
    // download from '/library/all' API

   const resources = file === 'yes' ? require(filePath) : await crawler.getAllCourses({ p, browser, ...opts, ms })
    if (resources.length && file === 'yes') {
        // const prefix = 'courses'
        // const filename = `${prefix}-${new Date().toISOString().replace(/:/g , "-")}.json`
        // await crawler.d(filename, prefix, resources, ms, opts);
        ms.stopAll('succeed');
    }
    await browser.close()
    // logger.log('1active spinner:', ms.hasActiveSpinners());
    ms.stopAll();

}

export const one = async (url, opts = {}) => {
    if (!url) throw new TypeError('`url` is required.')
    if (typeof url !== 'string') throw new TypeError(`Expected "url" to be of type "string", but "${typeof url}".`)

    opts = normalizeOpts(opts)
    logger.log('opts', opts, {url});
    const { oraLogger } = opts

    // login
    let crawler = new Crawler()
    crawler = await oraLogger.promise(crawler.login(opts), 'Login...')
    let p = new Puppy();
    let browser = await p.loginUser(opts);
    // get single course
    const resources = await crawler.getSingleCourse({ p, browser, url, ms, ...opts })

    if (resources?.length) {
        // const prefix = 'single-course'
        // const filename = `${prefix}-${new Date().toISOString().replace(/:/g , "-")}.json`
        // await crawler.d(filename, prefix, resources, ms, opts);
        // logger.log('2active spinner:', ms.hasActiveSpinners());
        ms.stopAll('succeed');
    }
    await browser.close()

}

function normalizeOpts(opts) {
    if (!opts.dir) opts.dir = process.cwd()
    if (!opts.oraLogger) opts.oraLogger = require('./helpers/nullLogger')
    if (!opts.oraLogger.isLogger) opts.oraLogger = createLogger(opts.oraLogger)
    if (!opts.concurrency) opts.concurrency = 10
    return opts
}
