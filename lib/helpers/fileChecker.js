import path from 'path';
import fs from 'fs-extra';
import sanitizeFilename from 'sanitize-filename';
import logger from "./logger.js";
import { differenceBy } from "lodash-es";
export default class FileChecker {
    static logger;
    static getFilesizeInBytes = filename => {
        return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
    };

    static createLogger(downloadFolder) {
        const logFile = path.join(downloadFolder, 'videos.txt');
        /* fs.existsSync(logFile) ?
             logger.log(`File ${logFile} already exists`) :
             logger.log(`File ${logFile} created`);*/
        return fs.createWriteStream(logFile, { flags: 'a' });
        // this.logger = fs.createWriteStream(logFile, { flags: 'a' });
        // return this.logger;
    };

    static write(downFolder, dest) {
        // logger.log('this.isCompletelyDownloaded(downFolder, dest)', this.isCompletelyDownloaded(downFolder, dest));
        if (!this.isCompletelyDownloadedWithOutSize(downFolder, dest)) {
            this.logger.write(`${dest} Size:${this.getFilesizeInBytes(dest)}\n`);
        }
    }

    static writeWithOutSize(downFolder, dest) {
        // logger.log('this.isCompletelyDownloaded(downFolder, dest)', this.isCompletelyDownloaded(downFolder, dest));
        if (!this.isCompletelyDownloadedWithOutSize(downFolder, dest)) {
            // this.createLogger(downFolder)
            // this.logger.write(`${dest}\n`);
            const videoLogger = this.createLogger(downFolder);
            videoLogger.write(`${dest}\n`);
        }
    }

    static findDownloadedVideos = downloadFolder => {
        const logFile = `${downloadFolder}${path.sep}videos.txt`;
        if (!fs.existsSync(logFile)) return [];
        return fs.readFileSync(logFile).toString().split("\n");
    }

    static isCompletelyDownloaded = (downloadFolder, videoName, remoteSize) => {
        const downloadedVideos = this.findDownloadedVideos(downloadFolder);
        if (typeof downloadedVideos === 'undefined' || downloadedVideos.length === 0) {
            return false;
        }
        videoName = `${videoName} Size:${remoteSize ?? this.getFilesizeInBytes(videoName)}`
        for (let downloadedVideoName of downloadedVideos) {
            // logger.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
            if (videoName === downloadedVideoName) {
                return downloadedVideoName;
            }
        }
        return false;
    }

    static isCompletelyDownloadedWithOutSize(downloadFolder, videoName) {
        const downloadedVideos = this.findDownloadedVideos(downloadFolder);
        if (typeof downloadedVideos === 'undefined' || downloadedVideos.length === 0) {
            return false;
        }
        videoName = `${videoName}`
        for (let downloadedVideoName of downloadedVideos) {
            // logger.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
            if (videoName === downloadedVideoName) {
                return downloadedVideoName;
            }
        }
        return false;
    }

    static addPageAsDownloaded(course, opts, index, lesson) {
        let series = sanitize(course.title)
        const dest = path.join(opts.dir, series, `${String(index + 1).padStart(2, '0')}-${lesson.title}`)
        const videoLogger = this.createLogger(path.join(opts.dir, series));
        videoLogger.write(`${dest}\n`);
    }

    static fileIsDownloaded(course, opts, index, lesson) {
        let series = sanitize(course.title)
        const dest = path.join(opts.dir, series, `${String(index + 1).padStart(2, '0')}-${lesson.title}`)
        let isDownloaded = this.isCompletelyDownloadedWithOutSize(path.join(opts.dir, series), dest)
        // logger.log('isDownloaded', isDownloaded, lesson.title);
        return isDownloaded;
    }

    findNotExistingVideo(videos, downloadFolder) {
        let i = 0;
        for (let video of videos) {
            const name = video.name.toString().replace(/[^A-Za-zА-Яа-я\d\s]/gmi, '').replace('Урок ', '');
            let filename = `${downloadFolder}${path.sep}${name}.mp4`;
            if (fs.existsSync(filename) && isCompletelyDownloaded(name, downloadFolder)) {
                logger.log(`File "${name}" already exists`);
                i++;
            } else {
                break;
            }
        }
        return i;
    };

    static linkFileExists(dest) {
        const logFile = path.join(dest, 'links.txt')

        if (!fs.existsSync(logFile)) return [];
        const fileNames = fs.readFileSync(logFile).toString().split("\n").filter(Boolean);

        const sanitizeFilenames = fileNames.map(url => url);//({url}) //fileName.split('/').pop().replace('.mp4', '').replace(/^\d+-/, '')
        // logger.log('linkFileExists sanitizeFilenames:', sanitizeFilenames.length);
        return sanitizeFilenames;
    }

    static linkFileExistsWithUrl(dest, resourceUrl) {
        const urls = this.linkFileExists(dest)
        // logger.log('--->', {urls, dest, resourceUrl});
        if (urls.length === 0) {
            return [];
        }

        const a = urls.find(resource => resource.url === resourceUrl) ?? [];
        return a
    }
    static writeResourceUrlWithOutSize(downFolder, url) {
        const a = this.linkFileExistsWithUrl(downFolder, url)
        // logger.log('writeResourceUrlWithOutSize:', a, a.length, a.length===0);
        if (a.length === 0) {
            // logger.log('usli');
            const videoLogger = this.createLogger(downFolder, 'links.txt');
            videoLogger.write(`${url}\n`);
        }
    }

    static getDownloadedFilenames(lessons, dest) {
        // logger.log('getDownloadedFilenames:', dest);
        const urls = this.linkFileExists(dest)
        if (urls.length === 0) {
            return lessons;
        }
        // logger.log('getDownloadedFilenames lessons:', lessons.length);

        const links = differenceBy(lessons, urls)//, 'url'
        // logger.log('links:', links.length);
        return links;

    }
}

/*module.exports = {
    findNotExistingVideo,
    isCompletelyDownloaded,
    createLogger
}*/
