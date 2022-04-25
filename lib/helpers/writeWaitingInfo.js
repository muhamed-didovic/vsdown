'use strict'

const cleanLine = require('./cleanLine')

function writeWaitingInfo(state, materialsName, ms, name, { localSizeInBytes, remoteSizeInBytes }) {
    // cleanLine();
    const percent = (state.percent*100).toFixed(2)
    const transferred = formatBytes(state.size.transferred)
    const total = formatBytes(state.size.total)
    const remaining = secondsToHms(state.time.remaining)
    const speed = formatBytes(state.speed)
    const t = `Downloading: ${percent}% | ${transferred} / ${total} | ${speed}/sec | ${remaining} - ${materialsName} Found:${localSizeInBytes}/${remoteSizeInBytes}`
    // process.stdout.write(text);
    ms.update(name, { text: t, color: 'blue' })
}

function formatBytes(bytes, decimals) {
    if (bytes == 0) return '0 Bytes'
    const k = 1024
    const dm = decimals || 2
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes)/Math.log(k))
    return parseFloat((bytes/Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function secondsToHms(sec) {
    const h = Math.floor(sec/3600)
    const m = Math.floor(sec%3600/60)
    const s = Math.floor(sec%3600%60)
    const hh = h < 10 ? '0' + h : h
    const mm = m < 10 ? '0' + m : m
    const ss = s < 10 ? '0' + s : s
    return `${hh}:${mm}:${ss}`
}

// module.exports = writeWaitingInfo;
// module.exports = formatBytes;

module.exports = {
    writeWaitingInfo,
    formatBytes,
    secondsToHms
}
