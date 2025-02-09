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
const crypto = require('crypto');

exports.logIn = functions.region('europe-west1').https.onRequest(logIn);
exports.signIn = functions.region('europe-west1').https.onRequest(signIn);

exports.getNotExistingFotoKey = functions.region('europe-west1').https.onRequest(createNewKey);
exports.getAllFotos = functions.region('europe-west1').https.onRequest(getAllFotos);
exports.getLogs = functions.region('europe-west1').https.onRequest(getLogs);

exports.getAllLocations = functions.region('europe-west1').https.onRequest(getAllLocations);
exports.updateLocation = functions.region('europe-west1').https.onRequest(updateLocation);

exports.getAllTags = functions.region('europe-west1').https.onRequest(getAllTags);
exports.updateTag = functions.region('europe-west1').https.onRequest(updateTag);

exports.getAllPeoples = functions.region('europe-west1').https.onRequest(getAllPeoples);
exports.updatePeople = functions.region('europe-west1').https.onRequest(updatePeople);

exports.getAllInstitutions = functions.region('europe-west1').https.onRequest(getAllInstitutions);
exports.updateInstitution = functions.region('europe-west1').https.onRequest(updateInstitution);

exports.getAllRightOwners = functions.region('europe-west1').https.onRequest(getAllRightOwners);
exports.updateRightOwner = functions.region('europe-west1').https.onRequest(updateRightOwner);

exports.getAllRightOwners = functions.region('europe-west1').https.onRequest(getAllRightOwners);
exports.updateRightOwner = functions.region('europe-west1').https.onRequest(updateRightOwner);

exports.getAllSubtypes = functions.region('europe-west1').https.onRequest(getAllSubtypes);
exports.updateSubtypes = functions.region('europe-west1').https.onRequest(updateSubtypes);

exports.edit = functions.region('europe-west1').https.onRequest(editImage);
exports.delete = functions.region('europe-west1').https.onRequest(deleteImage);
exports.upload = functions.runWith({timeoutSeconds: 300, memory: '2GB'}).region('europe-west1').https.onRequest(uploadImage);

exports.countKeyword = functions.region('europe-west1').https.onRequest(countKeyword);

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

async function signIn (request, response) {
    response.set("Access-Control-Allow-Origin", "*");

    const name = decodeURI(request.query.name);
    const email = decodeURI(request.query.email).toLowerCase();
    const password = decodeURI(request.query.pwd);

    const key = crypto.createHash('sha256').update(email).digest('hex');

    let obj = {
        error: null,
        uid: key,
        name: name,
        email: email,
        password: password,
        mode: 0
    };

    if (name !== "undefined") {
        await db.ref("users").child(key).set(obj);
    } else {
        const val = (await db.ref("users").child(key).once("value")).val()
        if (val === null || val.password !== password)
            obj.error = 300 // Access denied
        else {
            obj.mode = val.mode
            obj.name = val.name
        }
    }

    response.status(200).send(obj);
}

async function logIn (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");

}

async function createNewKey (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    response.status(200).send(db.ref("fotos").push().key)
}

async function getAllPeoples (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("peoples").once("value")).val();
    if (all === null) all = {}
    response.status(200).send(JSON.stringify(all));
}

async function getAllInstitutions (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("institutions").once("value")).val();
    if (all === null) all = {}
    response.status(200).send(JSON.stringify(all));
}

async function getAllRightOwners (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("rightOwners").once("value")).val();
    if (all === null) all = {}
    response.status(200).send(JSON.stringify(all));
}

async function getAllSubtypes (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("itemSubtypes").once("value")).val();
    if (all === null) all = {}
    response.status(200).send(JSON.stringify(all));
}

async function getAllTags (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("tags").once("value")).val();
    if (all === null) all = {}
    response.status(200).send(JSON.stringify(all));
}

async function getAllLocations (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("locations").once("value")).val();
    if (all === null) all = {}
    response.status(200).send(JSON.stringify(all));
}

async function getLogs (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let log = (await db.ref("logs").child(request.query.key).once("value")).val();
    if (log === null) log = {};
    response.status(200).send(JSON.stringify(log));
}

async function getAllFotos (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    let all = (await db.ref("fotos").once("value")).val();
    if (all === null) all = {};
    if (!(await checkIsAdmin(request.query.uid))) {
        for (const entry of Object.keys(all)) {
            try {
                delete all[entry].urls.original;
            } catch (e) {
                console.error(e);
            }
        }
    }
    response.status(200).send(JSON.stringify(all));
}

async function checkIsAdmin(uid) {
    return uid !== null && uid !== undefined; // TODO
}

async function editImage (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const foto = JSON.parse(decodeURI(request.query.foto));
    const key = request.query.key;
    const userName = request.query.userName;
    await db.ref("fotos").child(key).update(foto);
    await writeLogs(userName, key, foto);
    response.status(200).send();
}

async function deleteImage (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const key = request.query.key;
    await db.ref("fotos").child(key).remove();
    db.ref("logs").child(key).remove();
    response.status(200).send();
}

async function uploadImage (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const foto = JSON.parse(decodeURI(request.query.foto));
    const url = decodeURI(request.query.url);
    const key = request.query.key;
    const userName = request.query.userName;
    foto.urls = await generateThumbnail(key, url);
    foto.isPublic = true;
    await db.ref("fotos").child(key).set(foto);
    await writeLogs(userName, key, foto);
    response.status(200).send({id:key});
}

async function writeLogs(userId, key, foto) {
    const timeStamp = (new Date()).toISOString();
    writeLog(userId, key, foto, timeStamp, "annotation");
    writeLog(userId, key, foto, timeStamp, "creator");
    writeLog(userId, key, foto, timeStamp, "description");
    writeLog(userId, key, foto, timeStamp, "institution");
    writeLog(userId, key, foto, timeStamp, "isPublic");
    writeLog(userId, key, foto, timeStamp, "itemSubtype");
    writeLog(userId, key, foto, timeStamp, "location");
    writeLog(userId, key, foto, timeStamp, "photographedPeople");
    writeLog(userId, key, foto, timeStamp, "rightOwner");
    writeLog(userId, key, foto, timeStamp, "shortDescription");
    writeLog(userId, key, foto, timeStamp, "tags");
}

async function writeLog(userId, key, foto, timeStamp, property) {
    if (foto[property] !== undefined) {
        db.ref("logs").child(key).child(property).transaction((value) => {
            const createdObj = createLogObj(userId, timeStamp, foto[property]);
            if (value === null) {
                return [createdObj];
            }
            const lastVal = value[value.length - 1] ;
            if (isSameLog(lastVal, createdObj))
                return;
            value.push(createdObj)
            return value;
        });
    }
}

function isSameLog(log1, log2) {
    const val1 = log1.val;
    const val2 = log2.val;
    if (typeof val1 === "string" && typeof val2 === "string")
        return val1 === val2;
    if (typeof log1 === "boolean" && typeof log2 === "boolean")
        return log1 === log2;
    if (typeof val1 !== "object" && typeof val2 !== "object")
        return false;
    if (val1 === undefined && val2 === undefined)
        return true;
    if (val1 === undefined || val2 === undefined)
        return false;
    if (val1.length !== val2.length)
        return false;
    for (let i = 0; i < val1.length; i++)
        if (val1[i] !== val2[i])
            return false;
    return true;
}

function createLogObj(userId, time, obj) {
    return {
        user: userId,
        time: time,
        val: obj
    }
}

async function updatePeople (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const people = JSON.parse(decodeURI(request.query.people));
    const key = people.key!==null?people.key:db.ref("peoples").push().key;
    delete people.key;
    await db.ref("peoples").child(key).set(people);
    response.status(200).send({'key':key});
}

async function updateInstitution (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const institution = JSON.parse(decodeURI(request.query.institution));
    const key = institution.key!==null?institution.key:db.ref("institutions").push().key;
    delete institution.key;
    await db.ref("institutions").child(key).set(institution);
    response.status(200).send({'key':key});
}

async function updateRightOwner (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const institution = JSON.parse(decodeURI(request.query.rightOwner));
    const key = institution.key!==null?institution.key:db.ref("rightOwners").push().key;
    delete institution.key;
    await db.ref("rightOwners").child(key).set(institution);
    response.status(200).send({'key':key});
}

async function updateSubtypes (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const itemSubtype = JSON.parse(decodeURI(request.query.itemSubtype));
    const key = itemSubtype.key!==null?itemSubtype.key:db.ref("itemSubtypes").push().key;
    delete itemSubtype.key;
    await db.ref("itemSubtypes").child(key).set(itemSubtype);
    response.status(200).send({'key':key});
}

async function updateTag (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const tag = JSON.parse(decodeURI(request.query.tag));
    const key = tag.key!==null?tag.key:db.ref("tags").push().key;
    delete tag.key;
    await db.ref("tags").child(key).set(tag);
    response.status(200).send({'key':key});
}

async function updateLocation (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const location = JSON.parse(decodeURI(request.query.location));
    const key = location.key!==null?location.key:db.ref("locations").push().key;
    delete location.key;
    await db.ref("locations").child(key).set(location);
    response.status(200).send({'key':key});
}

async function removeKeyword (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const keyword = request.query.keyword;
    const key = request.query.key;
    await db.ref(keyword).child(key).remove();
    response.status(200).send();
}

async function countKeyword (request, response)  {
    response.set("Access-Control-Allow-Origin", "*");
    const key = request.query.key;
    const all = (await db.ref("fotos").once("value")).val();

    const matches = JSON.stringify(all).match(new RegExp(key,"g"));
    let count = 0;
    if (matches !== null)
        count = matches.length;
    response.status(200).send({'count': count});
}