// firebase-multi use foto firebase deploy
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.database();

exports.upload = functions.region('europe-west1').https.onRequest(uploadImage);

async function uploadImage (request, response)  {
    const foto = JSON.parse(decodeURI(request.query.foto));
    foto.id = getRandomInt(1000);
    await db.ref("fotos").push(foto);
    response.status(200).send({id:foto.id});
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}