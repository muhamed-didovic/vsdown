const path = require("path");

const series = require(path.resolve(process.cwd(), 'json/search-courses.json'));
const downloaded = require(path.resolve(process.cwd(), 'json/downloaded-courses.json'));
// logger.log('111', path.resolve(process.cwd(), 'json/search-courses.json'));
module.exports = {
    series,
    downloaded
};
