const path = require('path')
const fs = require('fs-extra')
const sanitize = require("sanitize-filename");
const logger = require("./logger.cjs");
const { differenceBy } = require("lodash");
module.exports = class FileChecker {

    static logger;
    static getFilesizeInBytes = filename => {
        return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
    };

    static createLogger(downloadFolder, fileName = 'videos.txt') {
        const logFile = path.join(downloadFolder, fileName);
        /* fs.existsSync(logFile) ?
             console.log(`File ${logFile} already exists`) :
             console.log(`File ${logFile} created`);*/
        return fs.createWriteStream(logFile, { flags: 'a' });
        // this.logger = fs.createWriteStream(logFile, { flags: 'a' });
        // return this.logger;
    };

    static write(downFolder, dest) {
        // console.log('this.isCompletelyDownloaded(downFolder, dest)', this.isCompletelyDownloaded(downFolder, dest));
        if (!this.isCompletelyDownloadedWithOutSize(downFolder, dest)) {
            this.logger.write(`${dest} Size:${this.getFilesizeInBytes(dest)}\n`);
        }
    }

    static writeWithOutSize(downFolder, dest) {
        // console.log('this.isCompletelyDownloaded(downFolder, dest)', this.isCompletelyDownloaded(downFolder, dest));
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
            // console.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
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
            // console.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
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
        // console.log('isDownloaded', isDownloaded, lesson.title);
        return isDownloaded;
    }

    findNotExistingVideo(videos, downloadFolder) {
        let i = 0;
        for (let video of videos) {
            const name = video.name.toString().replace(/[^A-Za-zА-Яа-я\d\s]/gmi, '').replace('Урок ', '');
            let filename = `${downloadFolder}${path.sep}${name}.mp4`;
            if (fs.existsSync(filename) && isCompletelyDownloaded(name, downloadFolder)) {
                console.log(`File "${name}" already exists`);
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

        return urls.find(resource => resource.url === resourceUrl) ?? [];
    }
    static writeResourceUrlWithOutSize(downFolder, url) {
        const a = this.linkFileExistsWithUrl(downFolder, url)
        // logger.log('writeResourceUrlWithOutSize:', a, a.length, a.length===0);
        if (a.length === 0) {
            // logger.log('usli:', downFolder);
            const videoLogger = this.createLogger(downFolder, 'links.txt');
            videoLogger.write(`${url}\n`);

            // const logFile = path.join(downFolder, 'links.txt')
            //
            // if (fs.existsSync(logFile)) {
            //     logger.log('links.txt exists:', logFile);
            // } else {
            //     logger.log('links.txt not exists:', logFile);
            // }
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
