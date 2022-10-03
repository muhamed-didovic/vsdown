const PDFDocument = require('pdfkit')
const fs = require('fs-extra')
const imgSize = require('image-size')
const path = require("path");

const folderContents = async (folder) => {
    const files = await fs.readdir(folder)
    // console.log('files', files);
    if (!files.length) {
        return console.log('No images found');
    } else {
        console.log(`found files: ${files.length} in folder: ${folder}`);
    }

    let f =  files
        .filter(file => file.includes('.png'))
        .map(file => {
            return path.join(folder, file)
        });
    console.log(`Creating PDF file from ${f.length} images found in folder: ${folder}...`);
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

module.exports = async (sourcePath, savePath) => {
    //const savePath = path.join(process.cwd(), saveDir, courseName, 'screens');
    // console.log('savePath', savePath);
    // await fs.ensureDir(savePath)
    return Promise
        .resolve()
        .then(async () => await folderContents(sourcePath))
        .then(async (imgs) => {
            // console.log('--imgs', imgs);
            if (!imgs.length) {
                console.log('No images found for PDF!!!');
                return Promise.resolve()
            }
            await convert(imgs, path.resolve(savePath))
            console.log(`PDF created at: ${sourcePath} - ${savePath}`);
            return 'Done';
        })
    //.catch(console.error)

}//();

