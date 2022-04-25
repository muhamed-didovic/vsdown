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
    createLogger
}
