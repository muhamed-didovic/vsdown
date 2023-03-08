#!/usr/bin/env node
const meow = require('meow')
const prompts = require('prompts')
const createLogger = require('./helpers/createLogger')
const { one, all } = require('.')
const path = require('path')
const fs = require('fs-extra')
const isValidPath = require('is-valid-path')
const Crawler = require("./Crawler")
const Fuse = require('fuse.js')

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
        concurrency: { type: 'number', alias: 'c', default: 10 },
        file       : { type: 'string', alias: 'f', default: 'no' },
        overwrite  : { type: 'string', alias: 'o', default: 'no' },
        markdown   : { type: 'string', alias: 'm', default: 'yes' },
    }
})

const logger = createLogger()
// const errorHandler = err => (console.log('\u001B[1K'), logger.fail(String(err)), process.exit(1))
// const errorHandler = err => (console.error(err), logger.fail(String(err)), process.exit(1))
const errorHandler = err => (console.error('MAIN errorr:', err), process.exit(1))//logger.fail(`HERE IS THE ERROR in string: ${String(err}`))

const askOrExit = question => prompts({ name: 'value', ...question }, { onCancel: () => process.exit(0) }).then(r => r.value);

const folderContents = async (folder) => {
    const files = await fs.readdir(folder)
    // console.log('files', files);
    if (!files.length) {
        return console.log('No files found');
    } else {
        console.log(`found some files: ${files.length} in folder: ${folder}`);
    }

    return files
        //.filter(file => file.includes('.png'))
        .map(file => {
            return ({
                title: file,
                value: path.join(folder, file)
            })
        });

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

    return {
        email,
        password,
        dir,
        concurrency
    };
}
(async () => {
    const { flags, input } = cli
    // console.log({ flags, input });
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
            message : `Enter a file path eg: ${path.resolve(process.cwd(), 'json/*.json')} `,
            choices : await folderContents(path.resolve(process.cwd(), 'json')),
            validate: isValidPath
        })
        if (file === 'yes' && !filePath) {
            throw new Error("You don't have any files, please try again but choose 'no' for 'Do you want download from a file'");
        }
        const options = await commonFlags(flags);
        all({ logger, file, filePath, overwrite, markdown, ...options }).catch(errorHandler)
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
        if (await fs.exists(path.resolve(process.cwd(), 'json/search-courses.json'))) {
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
    one(courseUrl, { logger, overwrite, markdown, ...options }).catch(errorHandler)
})()
