const path = require('path')
const fs = require('fs-extra')
const sanitize = require("sanitize-filename");

module.exports = class FileChecker {

    static logger;
    static getFilesizeInBytes = filename => {
        return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
    };

    static createLogger(downloadFolder) {
        const logFile = path.join(downloadFolder, 'videos.txt');
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
}


/*module.exports = {
    findNotExistingVideo,
    isCompletelyDownloaded,
    createLogger
}*/
