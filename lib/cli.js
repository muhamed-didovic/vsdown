#!/usr/bin/env node
import meow from "meow";
import path from "path";
import fs from "fs-extra";
import prompts from "prompts";
import isValidPath from "is-valid-path";
// import isEmail from "util-is-email";
import Fuse from "fuse.js";

import Crawler from "./Crawler.js";
import { all, one } from "./index.js";
import logger from "./helpers/logger.js";
import createLogger from "./helpers/createLogger.js";

import Bluebird from "bluebird";
import { fileURLToPath } from "url";
Bluebird.config({ longStackTraces: true });
global.Promise = Bluebird;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cli = meow(`
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
    --headless, -h      Enable headless (values: 'yes' or 'no'), default value is 'yes'
    --html, -l          Enable html download (values: 'yes' or 'no'), default value is 'yes'
    --free, -f          Download only free courses or all (values: 'yes' or 'no'), default value is 'yes'
    --concurrency, -c

Examples
    $ vsdown
    $ vsdown -a
    $ vsdown [url] [-e user@gmail.com] [-p password] [-d dirname] [-c number] [-f path-to-file] [-o yes/no] [-m yes/no]
`, {
    flags: {
        help       : { alias: 'h' },
        version    : { alias: 'v' },
        all        : { type: 'boolean', alias: 'a' },
        email      : { type: 'string', alias: 'e' },
        password   : { type: 'string', alias: 'p' },
        directory  : { type: 'string', alias: 'd' },
        concurrency: { type: 'number', alias: 'c', default: 7 },
        file       : { type: 'string', alias: 'f', default: 'no' },
        overwrite  : { type: 'string', alias: 'o', default: 'no' },
        markdown   : { type: 'string', alias: 'm', default: 'yes' },
        free  : {
            type: 'string',
            alias: 'f',
            default: 'yes'
        },
        headless  : {
            type: 'string',
            alias: 'h',
            default: 'yes'
        },
        html  : {
            type: 'string',
            alias: 't',
            default: 'yes'
        }
    }
})

const oraLogger = createLogger()
// const errorHandler = err => (logger.log('\u001B[1K'), oraLogger.fail(String(err)), process.exit(1))
// const errorHandler = err => (logger.error(err), oraLogger.fail(String(err)), process.exit(1))
const errorHandler = err => (logger.error('MAIN errorr:', err), process.exit(1))//oraLogger.fail(`HERE IS THE ERROR in string: ${String(err}`))

const askOrExit = question => prompts({ name: 'value', ...question }, { onCancel: () => process.exit(0) }).then(r => r.value);

const folderContents = async (folder) => {
    const files = await fs.readdir(folder)
    if (!files.length) {
        logger.warn('No files found for download by file')
        return;
    }
    logger.debug(`found some files: ${files.length} in folder: ${folder}`);
    return files.map(file => ({
        title: file,
        value: path.join(folder, file)
    }))
}
async function commonFlags(flags) {
    const email = flags.email || await askOrExit({
        type    : 'text',
        message : 'Enter email',
        validate: value => value.length < 5 ? 'Sorry, enter correct email' : true
    })
    const password = flags.password || await askOrExit({
        type    : 'password',
        message : 'Enter password',
        validate: value => value.length < 5 ? `Sorry, password must be longer` : true
    })

    const dir = flags.directory
        ? path.resolve(flags.directory)
        : path.resolve(await askOrExit({
            type    : 'text',
            message : `Enter a directory to save a file (eg: ${path.resolve(process.cwd())})`,
            initial : path.resolve(process.cwd(), 'videos/'),
            validate: isValidPath
        }))
    const concurrency = flags.concurrency || await askOrExit({
        type   : 'number',
        message: `Enter concurrency`,
        initial: 10
    })

    const headless = (['yes', 'no', 'y', 'n'].includes(flags.headless)
        ? flags.headless
        : await askOrExit({
            type   : 'select',
            message: 'Enable headless?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 1
        }))
    const html = (['yes', 'no', 'y', 'n'].includes(flags.html)
        ? flags.html
        : await askOrExit({
            type   : 'select',
            message: 'Include html as well?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 0
        }))

    const free = (['yes', 'no', 'y', 'n'].includes(flags.free)
        ? flags.free
        : await askOrExit({
            type   : 'select',
            message: 'Download only free courses?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 0
        }))

    return {
        email,
        password,
        dir,
        concurrency,
        headless,
        html,
        free
    };
}
(async () => {
    const { flags, input } = cli
    logger.info(`flags:`, flags)
    // const fileChoices = await folderContents(path.resolve(process.cwd(), 'json'))
    const overwrite = (['yes', 'no', 'y', 'n'].includes(flags.overwrite)
        ? flags.overwrite
        : await askOrExit({
            type   : 'select',
            message: 'Do you want to overwrite when the file name is the same?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 1
        }))
    const markdown = (['yes', 'no', 'y', 'n'].includes(flags.markdown)
        ? flags.markdown
        : await askOrExit({
            type   : 'select',
            message: 'Do you want to overwrite when the file name is the same?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 1
        }))

    if (flags.all || (input.length === 0 && await askOrExit({
        type: 'confirm', message: 'Do you want all courses?', initial: false
    }))) {
        const file = (['yes', 'no', 'y', 'n'].includes(flags.file)
            ? flags.file
            : await askOrExit({
                type   : 'select',
                message: 'Do you want download from a file?',
                choices: [
                    {
                        title: 'Yes',
                        value: 'yes'
                    },
                    {
                        title: 'No',
                        value: 'no'
                    }
                ],
                initial: 1
            }))

        /*const file = flags.file || await askOrExit({
            type   : 'confirm',
            message: 'Do you want download from a file',
            initial: false
        })*/

        const filePath = await askOrExit({//flags.file ||
            type    : file === 'yes' ? 'autocomplete' : null,
            message : `Enter a file path eg: ${path.resolve(__dirname, '../json/*.json')} `,
            choices : await folderContents(path.resolve(__dirname, '../json')),
            validate: isValidPath
        })
        if (file === 'yes' && !filePath) {
            throw new Error("You don't have any files, please try again but choose 'no' for 'Do you want download from a file'");
        }
        const options = await commonFlags(flags);
        all({ oraLogger, file, filePath, overwrite, markdown, ...options }).catch(errorHandler)
        return
    }

    //check if course url is provided, if yes then hide the options
    const searchOrDownload = await askOrExit({//flags.file ||
        type   : input.length === 0 ? 'confirm' : null,
        message: 'Choose "Y" if you want to search for a course otherwise choose "N" if you have a link for download',
        initial: true
    })

    if (input.length === 0 && searchOrDownload === false) {
        input.push(await askOrExit({
            type    : 'text',
            message : 'Enter url for download.',
            initial : 'https://vueschool.io/courses/javascript-testing-fundamentals',
            validate: value => value.includes('vueschool.io') ? true : 'Url is not valid'
        }))
    } else {
        let searchCoursesFile = false;
        if (await fs.exists(path.resolve(__dirname, `../json/search-courses.json`))) {
            searchCoursesFile = true;
        }

        const foundSearchCoursesFile = await askOrExit({
            type   : (searchCoursesFile && input.length === 0 && !flags.file) ? 'confirm' : null,
            message: 'Do you want to search for a courses from a local file (which is faster)',
            initial: true
        })

        input.push(await askOrExit({
            type   : input.length === 0 ? 'autocomplete' : null,
            message: 'Search for a course',
            choices: await Crawler.getCourses(foundSearchCoursesFile),
            suggest: (input, choices) => {
                if (!input) return choices;
                const fuse = new Fuse(choices, {
                    keys: ['title', 'value']
                })
                return fuse.search(input).map(i => i.item);
            },
        }))
    }

    const options = await commonFlags(flags);
    const courseUrl = input[0]
    one(courseUrl, { oraLogger, overwrite, markdown, ...options }).catch(errorHandler)
})()
