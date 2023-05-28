// @ts-check
const fs = require('fs')
const fileSize = require('./fileSize')
const progress = require('request-progress')
// const request = require('request')
const request = require('requestretry').defaults({ retryDelay: 500 })
const { writeWaitingInfo, formatBytes, secondsToHms } = require('./writeWaitingInfo')
const { createLogger, isCompletelyDownloaded } = require("./fileChecker");

const getFilesizeInBytes = filename => {
    // logger.log('stats', stats);
    return fs.existsSync(filename) ? fs.statSync(filename).size : 0
}

/**
 *
 * @param url
 * @param dest
 * @param localSizeInBytes
 * @param remoteSizeInBytes
 * @param downFolder
 * @param index
 * @param Spinnies ms
 * @returns {Promise<unknown>}
 */
const downloadVideo = (url, dest, {
    localSizeInBytes,
    remoteSizeInBytes,
    downFolder,
    index,
    ms
}) => new Promise(function (resolve, reject) {
    const name = url + index;
    const req = request({
        url,//: 'https://api.domain.com/v1/a/b',
        json: true,
        //fullResponse: true
    })

    const videoLogger = createLogger(downFolder);

    progress(req, { throttle: 2000, delay: 1000 })
        .on('progress', state => {
            //writeWaitingInfo(state, dest, ms, name, { localSizeInBytes, remoteSizeInBytes })
            const percent = (state.percent * 100).toFixed(2)
            const transferred = formatBytes(state.size.transferred)
            const total = formatBytes(state.size.total)
            const remaining = secondsToHms(state.time.remaining)
            const speed = formatBytes(state.speed)
            const t = `Downloading: ${percent}% | ${transferred} / ${total} | ${speed}/sec | ${remaining} - ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes}`
            ms.update(name, { text: t, color: 'blue' })
        })
        .on('end', () => {
            ms.succeed(name, { text: `End download video ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes}` })
            videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
            // logger.log(`End download video ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes}`);
            resolve()
        })
        .on('error', err => {
            //ms.remove(name);
            /*if (err.code === "ECONNRESET") {
                logger.error(`Timeout occurs. Details ${err.message}`);
            }*/
            //ms.fail(name, { text: err })
            logger.log('attempts', err.attempts);
            logger.log('ERR code:::', err.code, 'Name:', name);
            logger.log('ERRRRRRR:', err);
            reject(err)
        })
        .pipe(fs.createWriteStream(dest))
})

/**
 * @param {string} file
 * @param {import("fs").PathLike} dest
 * @param downFolder
 * @param ms
 * @param index
 */
module.exports = async (file, dest, { downFolder, ms, index = (Math.random() + 1).toString(36).substring(7) } = {}) => {
    // const random = (Math.random() + 1).toString(36).substring(7)
    // logger.log('1url + index', index);
    // url = encodeURI(url)
    // logger.log('URL to downlad', url, index);
    const url = file.url;
    const remoteFileSize = file.size;
    const name = url + index
    ms.add(name, { text: `Checking if video is downloaded: ${dest}` })
    //logger.log(`Checking if video is downloaded: ${dest}`);


    const localSize = getFilesizeInBytes(`${dest}`)
    const localSizeInBytes = formatBytes(getFilesizeInBytes(`${dest}`))
    let isDownloaded = isCompletelyDownloaded(downFolder, dest)
    // logger.log('remoteFileSize === localSize', remoteFileSize, localSize, remoteFileSize === localSize, 'isDownloaded:', isDownloaded);
    if (remoteFileSize === localSize || isDownloaded) {
        //ms.remove(name);
        ms.succeed(name, { text: `Video already downloaded: ${dest}` })
        // logger.log(`Video already downloaded: ${dest}`);
        return;
    } else {
        // logger.log(`${localSizeInBytes}/${formatBytes(remoteFileSize)} - Start download video: ${dest}`);
        ms.update(name, { text: `${localSizeInBytes}/${formatBytes(remoteFileSize)} - Start download video: ${dest}` })

        return await downloadVideo(url, dest, {
            localSizeInBytes,
            remoteSizeInBytes: formatBytes(remoteFileSize),
            downFolder,
            index,
            ms
        })
    }
}
