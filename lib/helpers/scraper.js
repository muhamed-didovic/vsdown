import path from 'path';
import sanitize from 'sanitize-filename';
import fs from 'fs-extra';
// import randomUseragent from "random-useragent";
// import downOverYoutubeDL from './downOverYoutubeDL.ts';
import logger from "./logger.js";

import randUserAgent from "rand-user-agent";
const agent = randUserAgent("desktop", "chrome", "linux");

// import req from 'requestretry';
// const j = req.jar();
// const request = req.defaults({
// 	jar: j,
// 	retryDelay: 500,
// 	fullResponse: true
// });

const scrollToBottomBrowser = async (timeout, viewportN) => {
	await new Promise((resolve) => {
		let totalHeight = 0, distance = 200, duration = 0, maxHeight = window.innerHeight * viewportN;
		const timer = setInterval(() => {
			duration += 200;
			window.scrollBy(0, distance);
			totalHeight += distance;
			if (totalHeight >= document.body.scrollHeight || duration >= timeout || totalHeight >= maxHeight) {
				clearInterval(timer);
				resolve();
			}
		}, 200);
	});
};
const hasValues = obj => obj && Object.keys(obj).length > 0;
const scrollToBottom = async (page, timeout, viewportN) => {
	// logger.info(`scroll puppeteer page to bottom ${viewportN} times with timeout = ${timeout}`);

	await page.evaluate(scrollToBottomBrowser, timeout, viewportN);
};
const blockNavigation = async (page, url) => {
	// logger.info(`block navigation for puppeteer page from url ${url}`);

	page.on('request', req => {
		logger.debug('[scraper] req.url() !== url', req.url(), url);
		if (req.isNavigationRequest() && req.frame() === page.mainFrame() && req.url() !== url) {
			req.abort('aborted');
		} else {
			req.continue();
		}
	});
	await page.setRequestInterception(true);
};


class PuppeteerPlugin {
	constructor({
		            opts = {},
		            scrollToBottom = null,
		            blockNavigation = false,
		            page = null,
		            lesson = false,
		            directory = false
	            } = {}) {
		this.opts = opts;
		this.scrollToBottom = scrollToBottom;
		this.blockNavigation = blockNavigation;
		this.headers = {
            'User-Agent': agent //randomUseragent.getRandom()
        };
		this.lesson = lesson
		this.page = page
		this.directory = directory
		// logger.info('init plugin', { launchOptions, scrollToBottom, blockNavigation });

		// let position = index + 1
		this.dest = path.join(this.directory, 'media')
	}

	apply(registerAction) {


		registerAction('afterResponse', async ({response}) => {
			const contentType = response.headers['content-type'];
			const isHtml = contentType && contentType.split(';')[0] === 'text/html';
            // logger.debug(`[scraper] ---------------------- afterResponse hook ---- [source]: ${ response.url } content-type: ${ contentType } isHtml: ${ isHtml }`)
			if (isHtml) {
                // logger.info(`[scraper] entering PuppeteerPlugin [source]: `, this.lesson.url, 'with response url:', response.url  )
				// logger.debug(`[scraper] entering PuppeteerPlugin [source]: ${this.lesson.url}`)
				// const url = response.url;
				const opts = this.opts
				const page = this.page
				// const course = this.lesson
				//const page = await this.browser.newPage();

				if (hasValues(this.headers)) {
				    // logger.info('set headers to puppeteer page', this.headers);
				    await page.setExtraHTTPHeaders(this.headers);
				}
				// logger.log('NEKI URRRRRRRRRRRRRRRRRRRRRR', url);
				// if (this.blockNavigation) {
				//     await blockNavigation(page, url);
				// }
				// logger.log('setovano storage', this.storage);
				// const lsBefore = await page.evaluate(() =>  Object.assign({}, window.localStorage));
				// logger.log('lsBefore', lsBefore);


				// await page.evaluateOnNewDocument (
				//     storage => {
				//         localStorage.clear();
				//         for (const [key, value] of Object.entries(storage)) {
				//             logger.log(`${key}: ${value}`);
				//             localStorage.setItem(key, value);//JSON.stringify(value)
				//         }
				//     }, this.storage);

				//await page.goto(url);
				// const ls = await page.evaluate(() =>  Object.assign({}, window.localStorage));
				// logger.log('poslije loada storage:', ls);


				// const iFrame = await page.$('iframe[src*="player.vimeo"]') !== null
				/*if (iFrame) {
					logger.log('iFrame', iFrame);
					const srcs = await page.evaluate(async () => {
						//find all iframe with vimeo links, download video and replace them
						const iFrame = document.querySelectorAll('iframe[src*="player.vimeo"]');
						let srcs = []
						iFrame.forEach((item, index) => {
							let src = item.src;

							const newItem = document.createElement("video");
							newItem.style = "width:640px; height:360px";
							// modify directly link to vimeo video from local media folder
							// newItem.src = src
							newItem.src = `media/${src.split('/').pop().split('?')[0]}.mp4`;
							item.parentNode.replaceChild(newItem, iFrame[index]);
							newItem.setAttribute("class", "iframe-video-tag-" + index);
							newItem.setAttribute("controls", "true");
							//let videoTag = document.getElementsByClassName("iframe-video-tag-" + index);
							// videoTag.src = src;
							//modify directly link to vimeo video from local media folder
							//videoTag.src = `media/${src.split('/').pop()}.mp4`;
							// return src
							srcs.push(src)

						});
						return srcs;
					});

					logger.log('srcs', srcs);
					await Promise.map(srcs, async (url, index) => {
							// logger.log('url--------------------', url);
							// const dest = path.join(opts.dir, course.downPath)
							// fs.ensureDir(dest)
							// const details = await getSizeOfVideo(course)
							const details = {
								size: -1,
								url : url
							}
							await downOverYoutubeDL(details, path.join(this.dest, `${url.split('/').pop().split('?')[0]}.mp4`), {
								...opts,
								downFolder: this.dest,
								index
							})

						}
						// ,{
						//     concurrency//: 1
						// }
					)
				}*/

                //check if there is popup before screenshot
                const elementExists = await page.$('.onesignal-slidedown-dialog') !== null
                // logger.log('elementExists', elementExists, opts)
                if (elementExists) {
                    logger.info('[PuppeteerPlugin] found popup onesignal-slidedown-dialog');
                    // await page.click("#onesignal-slidedown-cancel-button");
                    //remove element from the page
                    await page.evaluate(selector => {
                        // This function will be executed within the page.
                        // const elements = document.querySelectorAll(selector);
                        // for (let element of elements) {
                        //     element.parentNode.removeChild(element);
                        // }
                        const elementToRemove = document.querySelector(selector); // Replace 'selector' with the appropriate CSS selector for the element you want to delete
                        // const elementToRemove = document.querySelector('selector'); // Replace 'selector' with the appropriate CSS selector for the element you want to remove
                        if (elementToRemove) {
                            elementToRemove.parentNode.removeChild(elementToRemove); // Remove the element and its children from the DOM
                        }
                        if (elementToRemove) {
                            elementToRemove.remove(); // Remove the element from the DOM
                        }

                    }, '.onesignal-slidedown-dialog');
                    await page.waitForTimeout(1e3);
                }

				await page.waitForTimeout(1e3)
				if (this.scrollToBottom) {
					await scrollToBottom(page, this.scrollToBottom.timeout, this.scrollToBottom.viewportN);
				}

				const content = await page.content();
				// await page.close();
				// logger.debug(`[scraper] ending PuppeteerPlugin and scraper [source]: ${this.lesson.url}`)
				// convert utf-8 -> binary string because website-scraper needs binary
				return Buffer.from(content).toString('binary');
			} else {
				return response.body;
			}
		});
	}
}


const scraper = async (opts, page, directory, lesson) => {
	logger.debug(`[scraper] entering [source]: ${lesson.url}`)
	// import scrape from 'website-scraper';
	// import PuppeteerPlugin from 'website-scraper-puppeteer';
	const {default: scrape} = await import('website-scraper');
	const {default: SaveToExistingDirectoryPlugin} = await import('website-scraper-existing-directory');
	const urls = [lesson.url];
	// logger.log('URLS:', urls);
	// return Promise.all([
	//         import('website-scraper'),
	//         // import('website-scraper-puppeteer'),
	//     ])
	//     .then(async ([{ default: scrape }]) => {//, { default: PuppeteerPlugin }
	await scrape({
		// urls     : [
		//     'https://students.learnjavascript.today/lessons/welcome/',
		//     'https://students.learnjavascript.today/lessons/animating-with-js/'
		// ],
		// directory: `./zzz-${new Date().toISOString()}`,
		urls,//: [url],
		directory,
		sources: [
			{selector: 'style'},
			{selector: '[style]', attr: 'style'},
			{selector: 'img', attr: 'src'},
			{selector: 'img', attr: 'srcset'},
			{selector: 'input', attr: 'src'},
			{selector: 'object', attr: 'data'},
			{selector: 'embed', attr: 'src'},
			{selector: 'param[name="movie"]', attr: 'value'},
			{selector: 'script', attr: 'src'},
			{selector: 'link[rel="stylesheet"]', attr: 'href'},
			{selector: 'link[rel*="icon"]', attr: 'href'},
			{selector: 'svg *[xlink\\:href]', attr: 'xlink:href'},
			{selector: 'svg *[href]', attr: 'href'},
			{selector: 'picture source', attr: 'srcset'},
			{selector: 'meta[property="og\\:image"]', attr: 'content'},
			{selector: 'meta[property="og\\:image\\:url"]', attr: 'content'},
			{selector: 'meta[property="og\\:image\\:secure_url"]', attr: 'content'},
			{selector: 'meta[property="og\\:audio"]', attr: 'content'},
			{selector: 'meta[property="og\\:audio\\:url"]', attr: 'content'},
			{selector: 'meta[property="og\\:audio\\:secure_url"]', attr: 'content'},
			{selector: 'meta[property="og\\:video"]', attr: 'content'},
			{selector: 'meta[property="og\\:video\\:url"]', attr: 'content'},
			{selector: 'meta[property="og\\:video\\:secure_url"]', attr: 'content'},
			{selector: 'video', attr: 'src'},
			{selector: 'video source', attr: 'src'},
			{selector: 'video track', attr: 'src'},
			{selector: 'audio', attr: 'src'},
			{selector: 'audio source', attr: 'src'},
			{selector: 'audio track', attr: 'src'},
			{selector: 'frame', attr: 'src'},
			{selector: 'iframe', attr: 'src'},
			{selector: '[background]', attr: 'background'},

			{selector: 'a.svelte-prt11s', attr: 'href'}, //get source of course on pages
			{selector: 'a[href*=".zip"]', attr: 'href'}, //get sources on /components page
		],
		plugins: [
			new PuppeteerPlugin({
				opts,
				scrollToBottom: {timeout: 10000, viewportN: 10}, /* optional */
				blockNavigation: true, /* optional */
				page,
				lesson,
				directory
			}),
			new SaveToExistingDirectoryPlugin()
		],
		urlFilter: function (url) {
		    // logger.log('PARSING URL:', url, !url.includes('404'), !url.includes('player.vimeo.com'));
            if (url.includes('404')
                || url.includes('/img/img/')
                || url.includes('youtube.com')
                || url.includes('vimeo.com')
                || url.includes('player.vimeo.com')
                || url.includes('googletagmanager.com')
                || url.includes('google-analytics.com')
                || url.includes('beacon-v2.helpscout.net')
                || url.includes('accounts.google.com')
                || url.includes('googleads.g.doubleclick.net')
                || url.includes('sentry.io')
                || url.includes('static.ads-twitter.com')
                || url.includes('ads-twitter.com')
                || url.includes('connect.facebook.net')
                || url.includes('facebook.net')
                || url.includes('hsforms.com')
                || url.includes('hubspot.com')
                || url.includes('discord.com')
                || url.includes('facebook.com')

                || url.includes('app.js')
                || url.includes('/media/')
                || url.includes('stripe.com')
            ) {// || url.includes('/media/')
                return false
            }
            return true;
		},
	});
	return true
	//});


}
// (async () => {
// })();

// module.exports = scraper
export default scraper
