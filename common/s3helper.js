const AWS = require('aws-sdk')

const s3 = new AWS.S3()


const signedUrlExpireSeconds = 60 * 5
function getS3SignedUrlForGetObject(bucketName, fileKey, requestType){
    const url = s3.getSignedUrl(requestType==="get"?'getObject':'putObject', {
        Bucket: bucketName,
        Key: fileKey,
        Expires: signedUrlExpireSeconds
    })
    console.log(url)
    return url;
}

module.exports = {
    getS3SignedUrlForGetObject
}
