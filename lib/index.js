const createLogger = require('./helpers/createLogger')
const Crawler = require('./Crawler')

const Bluebird = require('bluebird')
Bluebird.config({ longStackTraces: true })
global.Promise = Bluebird;

const Spinnies = require('dreidels')
const ms = new Spinnies()

exports.all = async (opts = {}) => {
    opts = normalizeOpts(opts)
    const { logger, file, filePath } = opts

    // login
    let crawler = new Crawler()
    crawler = await logger.promise(crawler.login(opts), 'Login...')

    // download from '/library/all' API
    const courses = file ? require(filePath) : await crawler.getAllCourses({ ...opts, ms })
    const prefix = 'courses'
    const filename = `${prefix}-${new Date().toISOString()}.json`
    await crawler.d(filename, prefix, courses, ms, opts);
}

exports.one = async (url, opts = {}) => {
    if (!url) throw new TypeError('`url` is required.')
    if (typeof url !== 'string') throw new TypeError(`Expected "url" to be of type "string", but "${typeof url}".`)


    opts = normalizeOpts(opts)
    console.log('opts', opts, {url});
    const { logger } = opts

    // login
    let crawler = new Crawler()
    crawler = await logger.promise(crawler.login(opts), 'Login...')

    // get single course
    const course = await crawler.getSingleCourse({ url, ms, ...opts })

    const prefix = 'single-course'
    const filename = `${prefix}-${new Date().toISOString()}.json`
    await crawler.d(filename, prefix, course, ms, opts);
}

function normalizeOpts(opts) {
    if (!opts.dir) opts.dir = process.cwd()
    if (!opts.logger) opts.logger = require('./helpers/nullLogger')
    if (!opts.logger.isLogger) opts.logger = createLogger(opts.logger)
    if (!opts.concurrency) opts.concurrency = 10
    return opts
}
