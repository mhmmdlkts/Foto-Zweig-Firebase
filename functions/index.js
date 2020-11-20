// firebase-multi use foto firebase deploy

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const UUID = require("uuid-v4");
const db = admin.database();
const Jimp = require('jimp');
// const bucket = gcs.bucket(`${fbId}.appspot.com`);

exports.getNotExistingFotoKey = functions.region('europe-west1').https.onRequest(createNewKey);
exports.getAllFotos = functions.region('europe-west1').https.onRequest(getAllFotos);
exports.upload = functions.runWith({timeoutSeconds: 300, memory: '2GB'}).region('europe-west1').https.onRequest(uploadImage);

async function generateThumbnail (key, originalUrl) {
    const fileBucket = "foto-zweig-312d2.appspot.com";
    const filePath = `images/${key}/original.jpg`;
    const logoPath = `images/1-100.jpg`;
    const urls = {original: originalUrl};

    let uuid = UUID();

    const bucket = admin.storage().bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), "tempFile.jpg");
    const tempLogoPath = path.join(os.tmpdir(), "logo.jpg");
    const tempWaterMark = path.join(os.tmpdir(), "tempWater.jpg");

    const metadata = {
        contentType: "image/jpeg",
        metadata: {
            firebaseStorageDownloadTokens: uuid
        }
    }

    await bucket.file(filePath).download({destination: tempFilePath});
    await bucket.file(logoPath).download({destination: tempLogoPath});
    const thumbFilePath = path.join(path.dirname(filePath), 'thumbnail.jpg');
    const waterMarkFilePath = path.join(path.dirname(filePath), 'watermark.jpg');

    await Jimp.read(tempFilePath).then((tpl) =>
            Jimp.read(tempLogoPath).then((logoTpl) => {
                logoTpl.opacity(0.2)
                return tpl.composite(logoTpl, 0, 0, [Jimp.BLEND_DESTINATION_OVER])
            }),
        ).then((tpl) => tpl.write(tempWaterMark)).catch(e=> {
            console.log(e);
        });

    urls.watermark = await bucket.upload(tempWaterMark, {
        destination: waterMarkFilePath,
        metadata: metadata,
    }).then((data) => {
        return Promise.resolve("https://firebasestorage.googleapis.com/v0/b/" + bucket.name + "/o/" + encodeURIComponent(data[0].name) + "?alt=media&token=" + uuid);
    });

    await spawn('convert', [tempFilePath, '-thumbnail', '2000x200>', tempFilePath]);
    console.log('Thumbnail created at', tempFilePath);

    urls.thumbnail = await bucket.upload(tempFilePath, {
        destination: thumbFilePath,
        metadata: metadata,
    }).then((data) => {
        return Promise.resolve("https://firebasestorage.googleapis.com/v0/b/" + bucket.name + "/o/" + encodeURIComponent(data[0].name) + "?alt=media&token=" + uuid);
    });

    fs.unlinkSync(tempWaterMark);
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(tempLogoPath);
    return urls;
}

async function createNewKey (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    response.status(200).send(db.ref("fotos").push().key)
}

async function getAllFotos (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const all = (await db.ref("fotos").once("value")).val();
    response.status(200).send(JSON.stringify(all));
}

async function uploadImage (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const foto = JSON.parse(decodeURI(request.query.foto));
    const url = decodeURI(request.query.url);
    const key = request.query.key;
    foto.id = key;
    foto.urls = await generateThumbnail(key, url);
    await db.ref("fotos").child(key).set(foto);
    response.status(200).send({id:key});
}