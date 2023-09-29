const path = require("path");
// const logger = require("./logger.js");

const fs = require("fs-extra");
const logger = require("./logger.cjs");
const FileChecker = require("./fileChecker.cjs");

const YTDlpWrap = require('yt-dlp-wrap').default;
const ytDlpWrap = new YTDlpWrap();

function formatBytes(bytes, decimals) {
    if (bytes == 0) return '0 Bytes'
    const k = 1024
    const dm = decimals || 2
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes)/Math.log(k))
    return parseFloat((bytes/Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
const getFilesizeInBytes = filename => {
    return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
};

async function retry(fn, retriesLeft = 5, interval = 1000, exponential = false) {
    try {
        const val = await fn();
        return val;
    } catch (error) {
        if (retriesLeft) {
            logger.warn('.... p-cluster retrying left (' + retriesLeft + ')');
            logger.warn('retrying err', error);
            await new Promise(r => setTimeout(r, interval));
            return retry(fn, retriesLeft - 1, exponential ? interval * 2 : interval, exponential);
        } else {
            logger.error('Max retries reached');
            throw error
            //throw new Error('Max retries reached');
        }
    }
}





const mpbDown = async (url, dest, cb) => {//
    return new Promise((resolve, reject) => {
        ytDlpWrap
            .exec([
                url,
                "--write-subs",
                "--write-auto-sub",
                '--referer', 'https://laraveldaily.com/',
                "-o", path.resolve(dest),
                '--socket-timeout', '5',

                // '--retries', 'infinite',
                // '--fragment-retries', 'infinite'

                //"--sub-lang", "en.*",
                // "-o", path.toNamespacedPath(dest),
                // '--socket-timeout', '5',
                //...(skipVimeoDownload ? ['--skip-download'] : []),
            ])
            .on("progress", cb)
            .on("error", (err) => reject(err))
            .on("close", () => resolve())
    });
};

const ytdown = async (url, dest, ms, index, localSizeInBytes, remoteSizeInBytes, logger, downFolder, reject, resolve) => {
    return await retry(async () => {//return
        ytDlpWrap
            .exec([
                url,

                "--write-subs",
                "--write-auto-sub",

                '--referer', 'https://vueschool.io/',
                "-o", path.resolve(dest),
                '--socket-timeout', '5'
            ])
            .on('ytDlpEvent', (eventType, eventData) =>
                // logger.log(eventType, eventData)
                //65.0% of   24.60MiB at    6.14MiB/s ETA 00:01
                ms.update(dest, {text: `${eventType}: ${eventData} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`})
            )
            // .on("youtubeDlEvent", (eventType, eventData) => logger.log(eventType, eventData))
            .on("error", (error) => {
                // ms.remove(dest, { text: error })
                if (!error.message.includes('Unable to extract info section')) {
                    logger.error('URL:', url, 'dest:', dest, 'error--', error)
                }
                /*fs.unlink(dest, (err) => {
                    reject(error);
                });*/
                //return Promise.reject(error)
                reject(error);

            })
            .on("close", () => {
                // ms.succeed(dest, {text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`})//.split('/').pop()
                // ms.remove(dest);
                // logger.log(`${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`.green);
                // videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
                FileChecker.writeWithOutSize(downFolder, dest)
                resolve()
            })

    }, 6, 2e3, true);
}

module.exports = {
    ytdown,
    mpbDown
}
