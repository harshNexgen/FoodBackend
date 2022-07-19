const s3Helper = require('./common/s3helper');
const { createResponse} = require('./common/helper');
module.exports.getObjectUrl = async(event, context) =>{
    let reqBody = JSON.parse(event.body);
    const {bucketName, fileKey, requestType} = reqBody
    let url = s3Helper.getS3SignedUrlForGetObject(bucketName, fileKey, requestType)
    return createResponse(200, { "message": "Url generated successfully", url:url });
}