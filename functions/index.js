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

exports.getNotExistingFotoKey = functions.region('europe-west1').https.onRequest(createNewKey);
exports.getAllFotos = functions.region('europe-west1').https.onRequest(getAllFotos);

exports.getAllLocations = functions.region('europe-west1').https.onRequest(getAllLocations);
exports.updateLocation = functions.region('europe-west1').https.onRequest(updateLocation);

exports.getAllTags = functions.region('europe-west1').https.onRequest(getAllTags);
exports.updateTag = functions.region('europe-west1').https.onRequest(updateTag);

exports.getAllPeoples = functions.region('europe-west1').https.onRequest(getAllPeoples);
exports.updatePeople = functions.region('europe-west1').https.onRequest(updatePeople);

exports.getAllInstitutions = functions.region('europe-west1').https.onRequest(getAllInstitutions);
exports.updateInstitution = functions.region('europe-west1').https.onRequest(updateInstitution);

exports.upload = functions.runWith({timeoutSeconds: 300, memory: '2GB'}).region('europe-west1').https.onRequest(uploadImage);

async function generateThumbnail (key, originalUrl) {
    const fileBucket = "foto-zweig-312d2.appspot.com";
    const filePath = `images/${key}/original.jpg`;
    const logoPath = `watermark.png`;
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
                logoTpl.opacity(0.35)
                return tpl.composite(logoTpl, 0, 0, [Jimp.BLEND_DESTINATION_OVER, Jimp.BLEND_MULTIPLY])
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

    await spawn('convert', [tempFilePath, '-thumbnail', '2000x272>', tempFilePath]);
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

async function getAllPeoples (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const all = (await db.ref("peoples").once("value")).val();
    response.status(200).send(JSON.stringify(all));
}

async function getAllInstitutions (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const all = (await db.ref("institutions").once("value")).val();
    response.status(200).send(JSON.stringify(all));
}

async function getAllTags (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const all = (await db.ref("tags").once("value")).val();
    response.status(200).send(JSON.stringify(all));
}

async function getAllLocations (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const all = (await db.ref("locations").once("value")).val();
    response.status(200).send(JSON.stringify(all));
}

async function getAllFotos (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const all = (await db.ref("fotos").once("value")).val();

    if (!(await checkIsAdmin(request.query.uid))) {
        for (const entry of Object.keys(all)) {
            delete all[entry].urls.original;
        }
    }

    response.status(200).send(JSON.stringify(all));
}

async function checkIsAdmin(uid) {
    return uid !== null && uid !== undefined; // TODO
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

async function updatePeople (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const people = JSON.parse(decodeURI(request.query.people));
    const key = people.key!==undefined?people.key:db.ref("peoples").push().key;
    delete people.key;
    await db.ref("peoples").child(key).set(people);
    response.status(200).send();
}

async function updateInstitution (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const institution = JSON.parse(decodeURI(request.query.institution));
    const key = institution.key!==undefined?institution.key:db.ref("institutions").push().key;
    delete institution.key;
    await db.ref("institutions").child(key).set(institution);
    response.status(200).send();
}

async function updateTag (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const tag = JSON.parse(decodeURI(request.query.tag));
    const key = tag.key!==undefined?tag.key:db.ref("tags").push().key;
    delete tag.key;
    await db.ref("tags").child(key).set(tag);
    response.status(200).send();
}

async function updateLocation (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const location = JSON.parse(decodeURI(request.query.location));
    const key = location.key!==undefined?location.key:db.ref("locations").push().key;
    delete location.key;
    await db.ref("locations").child(key).set(location);
    response.status(200).send();
}