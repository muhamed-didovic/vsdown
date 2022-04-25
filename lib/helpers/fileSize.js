const remote = require('remote-file-size')

const getFileSize = (opts) => {
  return new Promise((resolve, reject) => {
    remote(opts, function (err, size) {
      if (err) reject(err)
      resolve(size)
    })
  })
}

module.exports = getFileSize
