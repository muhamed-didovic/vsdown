import path from 'path';
import fs from 'fs-extra';
import colors from 'colors';
import {pRetry} from '@byungi/p-retry';
import {pDelay} from '@byungi/p-delay';
import remote from "remote-file-size";

import logger from './logger.js';

// const youtubedl = require("youtube-dl-wrap")
// const YTDlpWrap = require('yt-dlp-wrap').default;

// import {formatBytes} from './writeWaitingInfo.js';
// import ytDlp from "./ytdlp.cjs"
// import async from 'async';

import Spinnies from "dreidels";
const ms = new Spinnies();

import {ytdown} from "./yt.cjs";
import {formatBytes} from "./writeWaitingInfo.js";
import FileChecker from './fileChecker.js';

const getFilesizeInBytes = filename => {
    return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
};

const download = (url, dest, { localSizeInBytes, remoteSizeInBytes, downFolder, index = 0, ms }) => {
    return new Promise(async (resolve, reject) => {
        const videoLogger = FileChecker.createLogger(downFolder);
        // await fs.remove(dest) // not supports overwrite..
        let name = dest + index;
        ms.update(name, {
            text : `to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`,
            color: 'blue'
        });
        // logger.log(`to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`)

        // const youtubeDlWrap = new youtubedl()
        // let youtubeDlEventEmitter = youtubeDlWrap
        const ytDlpWrap = new YTDlpWrap();
        let ytDlpEventEmitter = ytDlpWrap
        .exec([
            url,
            // '--all-subs',

            "--write-subs",
            "--write-auto-sub",

            '--referer', 'https://laracasts.com/',
            "-o", path.resolve(dest),
            '--socket-timeout', '5'
        ])
        /*.on("progress", (progress) => {
            ms.update(name, { text: `${index}. Downloading: ${progress.percent}% of ${progress.totalSize} at ${progress.currentSpeed} in ${progress.eta} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}` })
        })*/
        .on('ytDlpEvent', (eventType, eventData) =>
            // logger.log(eventType, eventData)
            //65.0% of   24.60MiB at    6.14MiB/s ETA 00:01
            ms.update(name, { text: `${eventType}: ${eventData} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}` })
        )
        // .on("youtubeDlEvent", (eventType, eventData) => logger.log(eventType, eventData))
        .on("error", (error) => {
            ms.remove(name, { text: error })
            logger.log('URL:', url, 'dest:', dest, 'error--', error)
            //ms.remove(dest);
            /*fs.unlink(dest, (err) => {
                reject(error);
            });*/
            reject(error);

        })
        .on("close", () => {
            //ms.succeed(dest, { text: `${index}. End download yt-dlp: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}` })//.split('/').pop()
            ms.remove(name);
            logger.log(`${index}. End download yt-dlp: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`);
            // videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
            FileChecker.write(downFolder, dest)
            resolve()
        })

    });
};

const downloadVideo = async (url, dest, {
    localSizeInBytes,
    remoteSizeInBytes,
    downFolder,
    index,
    ms
}) => {
    try {
        await pRetry(() => download(url, dest,
            {
                localSizeInBytes,
                remoteSizeInBytes,
                downFolder,
                index,
                ms
            }), {
            retries        : 3,
            onFailedAttempt: error => {
                logger.log(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
                // 1st request => Attempt 1 failed. There are 4 retries left.
                // 2nd request => Attempt 2 failed. There are 3 retries left.
                // …
            }
        })
    } catch (e) {
        logger.log('eeee', e);
        ms.remove(dest, { text: `Issue with downloading` });
        //reject(e)
    }
}


const newDownload = (url, dest, localSizeInBytes, remoteSizeInBytes, downFolder, index = 0, ms) => {
    return new Promise(async (resolve, reject) => {
        // const videoLogger = createLogger(downFolder);
        logger.debug('DOWNLOADING:', 'index:', index, 'url:', url, 'localSizeInBytes:', localSizeInBytes, 'remoteSizeInBytes:', remoteSizeInBytes);
        // await fs.remove(dest) // not supports overwrite..
        ms.update(dest, {
            text: `to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`,
            color: 'blue'
        });

        await ytdown(url, dest, ms, index, localSizeInBytes, remoteSizeInBytes, logger, downFolder, reject, resolve)
    });
};

const slowForever = async runner => {
    // options:
    // retries - Number of retries. Default is 1.
    // interval - Delay before retry. Default is 0.
    const [res] = await Promise.all([pRetry(runner, { retries: 50, interval: 3000 }), pDelay(2000)])//{retries: Infinity, interval: 30000}
    return res
}

/**
 * @param file
 * @param {import("fs").PathLike} dest
 * @param downFolder
 * @param index
 * @param ms
 */
export default async (file, dest, {overwrite, downFolder, index} = {}) => {
    const url = file.url;
    let remoteFileSize = file.size;
    logger.info(`[downOverYoutubeDL] Checking if video is downloaded: ${dest}`);//.split('/').pop()
    ms.add(dest, {text: `Checking if video is downloaded: ${dest.split('/').pop()}`})//

    let isDownloaded = false;
    let localSize = getFilesizeInBytes(`${dest}`)
    let localSizeInBytes = formatBytes(getFilesizeInBytes(`${dest}`))
    // isDownloaded = isCompletelyDownloaded(downFolder, dest)
    isDownloaded = FileChecker.isCompletelyDownloadedWithOutSize(downFolder, dest)
    logger.debug('[downOverYoutubeDL] isDownloaded>>>>', isDownloaded);
    // if (remoteFileSize === localSize || isDownloaded) {
    if (isDownloaded && overwrite === 'no') {
        ms.succeed(dest, {text: `${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)}`});
        //ms.remove(dest);
        logger.debug(`[downOverYoutubeDL] ${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)}`.blue);
        return;
    } else {
        ms.update(dest, {text: `${index} Start download video: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)} `});
        logger.debug(`[downOverYoutubeDL] ${index} Start ytdl download: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)} `);

        await slowForever(async () => await newDownload(
                url,
                dest,
                localSizeInBytes,
                formatBytes(remoteFileSize), //remoteSizeInBytes: formatBytes(remoteFileSize),
                downFolder,
                index,
                ms
            )
        )
        ms.succeed(dest, {text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${formatBytes(remoteFileSize)} - Size:${formatBytes(getFilesizeInBytes(dest))}`})//.split('/').pop()
        logger.info('[downOverYoutubeDL] File is downloaded:', dest)
        // ms.remove(dest)
    }
}

