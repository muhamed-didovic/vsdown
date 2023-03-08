// @ts-check
const pRetry = require('@byungi/p-retry').pRetry
const pDelay = require('@byungi/p-delay').pDelay

module.exports  = retrier = async runner => {
    // options:
    // retries - Number of retries. Default is 1.
    // interval - Delay before retry. Default is 0.
    const [res] = await Promise.all([pRetry(runner, { retries: 10, interval: 3000 }), pDelay(2000)])//{retries: Infinity, interval: 30000}
    return res
}
