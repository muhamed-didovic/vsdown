import ufs from "url-file-size";
import {orderBy} from "lodash-es";

import req from "requestretry";
const j = req.jar();
const request = req.defaults({ jar: j, retryDelay: 500, fullResponse: true });

import retry from "./retry.js";
import logger from "./logger.js";
const findVideoUrl = (str, url) => {
    // \b(?:playerC|c)onfig\s*=\s*({.+?})(?:\s*;|\n)
    const regex = /(?:\bconfig|window\.playerConfig)\s*=\s*({.+?};?\s*var)/ // /playerConfig = {(.*)}; var/gm
    let res = regex.exec(str);
    let configParsed;
    if (res !== null && typeof res[0] !== "undefined") {
        try {
            // logger.log('res', res[1]);
            configParsed = res[1].trim().replace('var', '').trim().replace(/(;\s*$)/g, "");
            // configParsed = configParsed.replace(/(; var\s*$)/g, '');
            // configParsed = configParsed.replace(/(;\s*$)/g, '');
            // logger.log('---', configParsed);
            configParsed = JSON.parse(`${configParsed}`);
            let progressive = configParsed.request.files.progressive;

            if (!progressive.length) {
                // logger.log('Noooooooooooooooooooooooooooooooooooooooooooooooo', url);
                return null;
            }

            // logger.log('progressive', url, progressive);
            let video = orderBy(progressive, ['width'], ['desc'])[0];
            // logger.log('video', video);
            return video.url;
        } catch (err) {
            logger.error('error with findVideoUrl:', url, '-->err:', err);
            logger.error('json config:', configParsed);
            logger.error('res:', res[1]);
            // await fs.writeFile(path.join(dest, 'markdown', `${course.title}.md`), md, 'utf8')//-${Date.now()}
            // fs.writeFileSync(`./json/test.txt`, res, 'utf8')
            throw err;
        }

    }
    logger.warn('NO VIDEO FOUND:', url);
    // fs.writeFileSync(`./json/no-config-found-${Date.now()}.txt`, str, 'utf8')
    return null;
}

const vimeo = async course => {

    const vimeoUrl = course.vimeoUrl
    try {

        const v = await retry(async () => {//return
            const { body, attempts } = await request({
                url        : vimeoUrl,
                maxAttempts: 50,
                headers    : {
                    'Referer'   : "https://laraveldaily.com/",
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36'
                }
            })

            return findVideoUrl(body, vimeoUrl)

        }, 6, 1e3, true)

        if (!v) {
            return {
                size: -1,
                url : vimeoUrl
            }
        }
        //you-get --referer="https://laracasts.com/" "https://player.vimeo.com/video/623682023?h=6191c5eb7c&color=328af1&autoplay=1&app_id=122963"
        //yt-dlp --referer "https://fireship.io/" "https://player.vimeo.com/video/320683048?h=a73f4772a1&app_id=122963"
        //yt-dlp --referer "https://laracasts.com/" --list-subs "https://player.vimeo.com/video/623682023?h=6191c5eb7c&color=328af1&autoplay=1&app_id=122963"
        // yt-dlp --referer "https://laracasts.com/" "https://player.vimeo.com/video/722977328?h=9726bc7a98&color=328af1&autoplay=1&app_id=122963"
        const { headers, attempts: a } = await request({
            url         : v,
            json        : true,
            maxAttempts : 50,
            method      : "HEAD",
            fullResponse: true, // (default) To resolve the promise with the full response or just the body
            'headers'   : {
                'Referer': "https://laraveldaily.com/"
            }
        })

        if (course?.url) {
            const response = await retry(async () => {//return
                return await request({
                    url        : course.url,
                    maxAttempts: 50,
                    method     : "HEAD",
                })

            }, 6, 1e3, true)

            // logger.log('response.statusCode:', typeof response.statusCode, response.statusCode);
            if (response.statusCode !== 429) {
                let size = 0;
                try {
                    size = await ufs(response.request.uri.href)
                } catch (err) {
                    logger.log('URL:', response.request.uri.href, 'ERR with ufs:', err);
                    if (err !== 'Couldn\'t get file size') {
                        throw err;
                    }
                }

                if (size > headers['content-length']) {
                    logger.log('compare url->viemo', formatBytes(size), formatBytes(headers['content-length']), '----');
                    //logger.log('compare: size > headers[\'content-length\']', size, headers['content-length'], response.request.uri.href);
                    return {
                        url: response.request.uri.href,
                        size
                    }
                }
            }
        }
        return {
            //return here Vimeo url, instead of a particular video('v'), ytdl will get the best one
            url: vimeoUrl,
            // vimeo: vimeoUrl,
            size: headers['content-length']
        };
    } catch (err) {
        logger.error('ERR::', err, 'vimeoUrl:', vimeoUrl, 'url:', course?.url);
        /*if (err.message === 'Received invalid status code: 404') {
            return Promise.resolve();
        }*/
        throw err;
    }
};

export default vimeo;
