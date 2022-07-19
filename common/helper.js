const phoneVerification = require('awesome-phonenumber');
function createResponse(statusCode, message) {
    return {
        statusCode: statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
          },
        body: JSON.stringify(message)
    };
}



function isPhoneNumberValid(phoneNumber) {
 
    let isPhoneValid = new phoneVerification(phoneNumber);
    if (!isPhoneValid.isValid()) {
        return { 'code': 'PHONE_NOT_VALID', 'error': 'Please Enter a Valid Phone Number' };
    }
    return true
}

function randomString(length, chars) {
    let result = '';
    for (let i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
}

function arePointsInRange(productLatLng, userLatLng, km) {
    let ky = 40000 / 360;
    let kx = Math.cos(Math.PI * userLatLng.Lat / 180.0) * ky;
    let dx = Math.abs(userLatLng.Long - productLatLng.Long) * kx;
    let dy = Math.abs(userLatLng.Lat - productLatLng.Lat) * ky;
    console.log("distance between points -> ", Math.sqrt(dx * dx + dy * dy))
    return Math.sqrt(dx * dx + dy * dy) <= km;
}


module.exports = {
    createResponse,
    isPhoneNumberValid,
    randomString,
    arePointsInRange
}
