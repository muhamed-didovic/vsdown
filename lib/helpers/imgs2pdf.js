import PDFDocument from "pdfkit";
import fs from "fs-extra";
import imgSize from "image-size";
import path from "path";
import logger from './logger.js';

const folderContents = async (folder) => {
    const files = await fs.readdir(folder)
    // logger.log('files', files);
    if (!files.length) {
        return logger.debug('[img2Pdf] No images found');
    } else {
        logger.debug(`[img2Pdf] found files: ${files.length} in folder: ${folder}`);
    }

    let f =  files
    .filter(file => file.includes('.png'))
    .map(file => {
        return path.join(folder, file)
    });
    logger.debug(`[img2Pdf] Creating PDF file from ${f.length} images found in folder: ${folder}...`);
    return f;
}
const convert = (imgs, dest) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false })

    doc.pipe(fs.createWriteStream(dest))
    .on('finish', resolve)
    .on('error', reject)

    for (const img of imgs) {
        const { width, height } = imgSize(img)
        doc.addPage({ size: [width, height] }).image(img, 0, 0)
    }

    doc.end()
})

export default async (sourcePath, savePath) => {
    //const savePath = path.join(process.cwd(), saveDir, courseName, 'screens');
    // logger.log('savePath', savePath);
    // await fs.ensureDir(savePath)
    return Promise
    .resolve()
    .then(async () => await folderContents(sourcePath))
    .then(async (imgs) => {
        // logger.log('--imgs', imgs);
        if (!imgs.length) {
            logger.warn('[img2Pdf] No images found for PDF!!!');
            return Promise.resolve()
        }
        await convert(imgs, path.resolve(savePath))
        logger.info(`[img2Pdf] PDF created at: ${sourcePath} - ${savePath}`);
        return 'Done';
    })
    //.catch(logger.error)

}//();

