const path = require('path')
const fs = require('fs-extra')

const getFilesizeInBytes = filename => {
    return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
};

const createLogger = downloadFolder => {
    const logFile = `${downloadFolder}${path.sep}videos.txt`
    /* fs.existsSync(logFile) ?
         console.log(`File ${logFile} already exists`) :
         console.log(`File ${logFile} created`);*/
    const logger = fs.createWriteStream(logFile, { flags: 'a' });
    return logger;
};

const write = (downFolder, dest) => {
    // console.log('isCompletelyDownloaded(downFolder, dest)', isCompletelyDownloaded(downFolder, dest));
    if (!isCompletelyDownloadedWithOutSize(downFolder, dest)) {
        logger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
    }
}

const writeWithOutSize = (logger, downFolder, dest) => {
    // console.log('isCompletelyDownloaded(downFolder, dest)', isCompletelyDownloaded(downFolder, dest));
    if (!isCompletelyDownloadedWithOutSize(downFolder, dest)) {
        logger.write(`${dest}\n`);
    }
}

const findDownloadedVideos = downloadFolder => {
    const logFile = `${downloadFolder}${path.sep}videos.txt`;
    if (!fs.existsSync(logFile)) return [];
    return fs.readFileSync(logFile).toString().split("\n");
}

const isCompletelyDownloaded = (downloadFolder, videoName) => {
    const downloadedVideos = findDownloadedVideos(downloadFolder);
    if (typeof downloadedVideos === 'undefined' || downloadedVideos.length === 0) {
        return false;
    }
    videoName = `${videoName} Size:${getFilesizeInBytes(videoName)}`
    for (let downloadedVideoName of downloadedVideos) {
        // console.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
        if (videoName === downloadedVideoName) {
            return downloadedVideoName;
        }
    }
    return false;
}

const isCompletelyDownloadedWithOutSize = (downloadFolder, videoName) => {
    const downloadedVideos = findDownloadedVideos(downloadFolder);
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

const addPageAsDownloaded = (course, opts, index, lesson) => {
    let series = sanitize(course.title)
    const dest = path.join(opts.dir, series, `${String(index + 1).padStart(2, '0')}-${lesson.title}`)
    const videoLogger = createLogger(path.join(opts.dir, series));
    videoLogger.write(`${dest}\n`);
}

const fileIsDownloaded = (course, opts, index, lesson) => {
    let series = sanitize(course.title)
    const dest = path.join(opts.dir, series, `${String(index + 1).padStart(2, '0')}-${lesson.title}`)
    let isDownloaded = isCompletelyDownloadedWithOutSize(path.join(opts.dir, series), dest)
    // console.log('isDownloaded', isDownloaded, lesson.title);
    return isDownloaded;
}

const findNotExistingVideo = (videos, downloadFolder) => {
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

module.exports = {
    findNotExistingVideo,
    isCompletelyDownloaded,
    createLogger,
    isCompletelyDownloadedWithOutSize,
    writeWithOutSize
}
