# Downloader and scraper for vueschool.io

[![npm](https://badgen.net/npm/v/vsdown)](https://www.npmjs.com/package/vsdown)
[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Fmuhamed-didovic%2Fvsdown&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)


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
    --file, -f          Location of the file where are the courses
    --concurrency, -c

Examples
    $ vsdown
    $ vsdown -a
    $ vsdown [url] [-e user@gmail.com] [-p password] [-d dirname] [-c number] [-f path-to-file]
```

## License
MIT
