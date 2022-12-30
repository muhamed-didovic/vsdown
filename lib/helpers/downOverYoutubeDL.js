// @ts-check
const fileSize = require('./fileSize')
const { formatBytes, writeWaitingInfoDL } = require('./writeWaitingInfo');
const { createLogger, isCompletelyDownloaded, isCompletelyDownloadedWithOutSize, writeWithOutSize } = require('./fileChecker');
const path = require('path')
const colors = require('colors');
const fs = require('fs-extra')
const Promise = require('bluebird')

// const ytdl = require('ytdl-run')
// const youtubedl = require("youtube-dl-wrap")
const YTDlpWrap = require('yt-dlp-wrap').default;

const pRetry = require('@byungi/p-retry').pRetry
const pDelay = require('@byungi/p-delay').pDelay

const getFilesizeInBytes = filename => {
    return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
};

const download = (url, dest, {
    localSizeInBytes,
    remoteSizeInBytes,
    downFolder,
    index = 0,
    ms
}) => {
    return new Promise(async (resolve, reject) => {
        const videoLogger = createLogger(downFolder);
        // await fs.remove(dest) // not supports overwrite..
        ms.update(dest, {
            text : `to be processed by youtube-dl... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`,
            color: 'blue'
        });
        // console.log(`to be processed by youtube-dl... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`)

        const youtubeDlWrap = new youtubedl()
        let youtubeDlEventEmitter = youtubeDlWrap
            .exec([
                url,
                '--all-subs',
                '--referer', 'https://vueschool.io/',
                "-o", path.toNamespacedPath(dest),
                '--socket-timeout', '5',
            ])
            .on("progress", (progress) => {
                ms.update(dest, { text: `${index}. Downloading: ${progress.percent}% of ${progress.totalSize} at ${progress.currentSpeed} in ${progress.eta} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}` })
            })
            // .on("youtubeDlEvent", (eventType, eventData) => console.log(eventType, eventData))
            .on("error", (error) => {
                // ms.remove(dest, { text: error })
                console.log('error--', error)
                ms.remove(dest);
                /*fs.unlink(dest, (err) => {
                    reject(error);
                });*/
                reject(error);

            })
            .on("close", () => {
                ms.succeed(dest, { text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}` })//.split('/').pop()
                // ms.remove(dest);
                // console.log(`${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`.green);
                writeWithOutSize(videoLogger, downFolder, dest);//`${dest} Size:${getFilesizeInBytes(dest)}\n`
                resolve()
            })

    });
};

const downloadVideo = async (url, dest, {
    localSizeInBytes,
    remoteSizeInBytes,
    downFolder,
    index = 0,
    ms
}) => {
    try {
        await pRetry(
            () => download(url, dest,
                {
                    localSizeInBytes,
                    remoteSizeInBytes,
                    downFolder,
                    index,
                    ms
                }),
            {
                retries        : 3,
                onFailedAttempt: error => {
                    console.log(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
                    // 1st request => Attempt 1 failed. There are 4 retries left.
                    // 2nd request => Attempt 2 failed. There are 3 retries left.
                    // …
                }
            })
    } catch (e) {
        console.log('eeee', e);
        ms.remove(dest, { text: `Issue with downloading` });
    }
}

const newDownload = async (url, dest, {
    file,
    localSizeInBytes,
    remoteSizeInBytes,
    downFolder,
    index = 0,
    ms
}) => {
    return new Promise(async (resolve, reject) => {
        // console.log('file', file);
        const { skipVimeoDownload, vimeoUrl } = file;

        const videoLogger = createLogger(downFolder);
        // await fs.remove(dest) // not supports overwrite..
        ms.update(dest, {
            text : `to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`,
            color: 'blue'
        });
        // console.log(`to be processed by youtube-dl... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes} - ${url}`)
        // return Promise.resolve()
        // https://player.vimeo.com/texttrack/17477597.vtt?token=6321c441_0x383403d52f6fdaa619c98c88b50efbb63b6d0096
        // const youtubeDlWrap = new youtubedl()
        // return youtubeDlWrap
        const ytDlpWrap = new YTDlpWrap();
        let ytDlpEventEmitter = ytDlpWrap
            .exec([
                url,

                "--write-subs",
                "--write-auto-sub",

                '--referer', 'https://vueschool.io/',
                "-o", path.resolve(dest),
                '--socket-timeout', '5'

                // '--all-subs',
                // '--referer', 'https://codecourse.com/',
                // "-o", path.toNamespacedPath(dest),
                // '--socket-timeout', '5',
                //...(skipVimeoDownload ? ['--skip-download'] : []),
            ])
            .on('ytDlpEvent', (eventType, eventData) =>
                // console.log(eventType, eventData)
                //65.0% of   24.60MiB at    6.14MiB/s ETA 00:01
                ms.update(dest, { text: `${eventType}: ${eventData} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}` })
            )
            // .on("youtubeDlEvent", (eventType, eventData) => console.log(eventType, eventData))
            .on("error", (error) => {
                ms.remove(dest, { text: error })
                console.log('URL:', url, 'dest:', dest, 'error--', error)
                //ms.remove(dest);
                /*fs.unlink(dest, (err) => {
                    reject(error);
                });*/
                //return Promise.reject(error)
                reject(error);

            })
            .on("close", () => {
                //ms.succeed(dest, { text: `${index}. End download yt-dlp: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}` })//.split('/').pop()
                ms.remove(dest);
                console.log(`${index}. End download yt-dlp: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`);
                // videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
                //FileChecker.write(downFolder, dest)
                videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
                // return Promise.resolve()
                resolve()
            })
    })
}

/**
 * @param file
 * @param {import("fs").PathLike} dest
 * @param downFolder
 * @param index
 * @param ms
 */
module.exports = async (file, dest, { downFolder, index, ms, overwrite } = {}) => {
    const url = file.url;
    let remoteFileSize = file.size;//0 ;//
    ms.add(dest, { text: `Checking if video is downloaded: ${dest.split('/').pop()}` });
    // console.log(`Checking if video is downloaded: ${dest.split('/').pop()}`);

    let isDownloaded = false;
    let localSize = getFilesizeInBytes(`${dest}`)
    let localSizeInBytes = formatBytes(getFilesizeInBytes(`${dest}`))
    isDownloaded = isCompletelyDownloaded(downFolder, dest) //isCompletelyDownloadedWithOutSize(downFolder, dest)
    // console.log('isDownloaded', isDownloaded, localSize, remoteFileSize, remoteFileSize == localSize, remoteFileSize === localSize);
    if (remoteFileSize == localSize || isDownloaded) {
    // if (isDownloaded && overwrite === 'no') {
        // ms.succeed(dest, { text: `${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)}` });
        ms.remove(dest);
        console.log(`${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)}`.blue);
        return;
    } else {
        ms.update(dest, { text: `${index} Start download video: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)} ` });
        // console.log(`${index} Start ytdl download: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)} `);
        return await newDownload(url, dest, {
            file,
            localSizeInBytes,
            remoteSizeInBytes: formatBytes(remoteFileSize),
            downFolder,
            index,
            ms
        });
    }
}

