[![npm](https://badgen.net/npm/v/vsdown)](https://www.npmjs.com/package/vsdown)
[![Downloads](https://img.shields.io/npm/dm/vsdown.svg?style=flat)](https://www.npmjs.org/package/vsdown)
[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Fmuhamed-didovic%2Fvsdown&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)
[![license](https://flat.badgen.net/github/license/muhamed-didovic/vsdown)](https://github.com/muhamed-didovic/vsdown/blob/main/LICENSE)

# Downloader and scraper for vueschool.io

## Requirement (ensure that you have it installed)
- Node 18
- yt-dlp (https://github.com/yt-dlp/yt-dlp)

## Install
```sh
npm i -g vsdown
```

#### without Install
```sh
npx vsdown
```

## CLI
```sh
Usage
    $ vsdown [CourseUrl]

Options
    --all, -a           Get all courses.
    --email, -e         Your email.
    --password, -p      Your password.
    --directory, -d     Directory to save.
    --file, -f          Location of the file where are the courses (values: 'yes' or 'no'), default value is 'no'
    --overwrite, -o     Overwrite if resource exists (values: 'yes' or 'no'), default value is 'no'
    --markdown, -m      Save each lesson's description into md file (values: 'yes' or 'no'), default: yes
    --concurrency, -c

Examples
    $ vsdown
    $ vsdown -a
    $ vsdown [url] [-e user@gmail.com] [-p password] [-d dirname] [-c number] [-f path-to-file] [-o yes/no] [-m yes/no]
```

## Log and debug
This module uses [debug](https://github.com/visionmedia/debug) to log events. To enable logs you should use environment variable `DEBUG`.
Next command will log everything from `scraper`
```bash
export DEBUG=scraper*; vsdown
```

Module has different loggers for levels: `scraper:error`, `scraper:warn`, `scraper:info`, `scraper:debug`, `scraper:log`. Please read [debug](https://github.com/visionmedia/debug) documentation to find how to include/exclude specific loggers.

## License
MIT
