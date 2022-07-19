const { v4: uuidv4 } = require('uuid');
const dynamoOperations = require('./common/dynamo');
const { createResponse, isPhoneNumberValid } = require('./common/helper');

module.exports.addOffering = async (event, context) => {
    console.log("add offerings");
    let reqBody = JSON.parse(event.body);
    let { phoneNumber, userId, productName, price } = reqBody;
    let {appId} = event.queryStringParameters || {};
    appId =  appId ? appId : 'food';
    if (!phoneNumber || !userId || !price || !productName) {
        return createResponse(400, { "message": "phoneNumber ,  UserId , price or ProductName Missing" });
    }

    let checkPhoneNumber = isPhoneNumberValid(phoneNumber);
    if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
        return createResponse(400, { "message": "phoneNumber not valid!" });
    }


    let userItem = await dynamoOperations.findUserById(userId);
    console.log("userItem is", userItem);
    if (userItem.Count > 0) {
        let productOfferingId =  uuidv4();
        let productOffering = {
            productOfferingId,
            userId,
            productName,
            price
        }

        Object.keys(reqBody).map((key, index, array) => {
            productOffering[key] = reqBody[key]
        });
        productOffering["productStatus"] = "new"
        productOffering["totalQuantitySold"] = 0;
        productOffering["pickedQuantity"] = 0;
        productOffering["appId"] = appId;
        console.log("productoffering is"  ,productOffering);

        let productOfferTemplateByName = await dynamoOperations.findProductOfferingTemplateByName(productName,userId);
        if (productOfferTemplateByName.Count > 0) {
            //return createResponse(400, { "message": "productOffering template Already Exists" , "productOfferingTemplate" : productOfferTemplateByName.Items[0] });
        }
        
        else{
            if(!productOfferTemplateByName || productOfferTemplateByName.Count === 0) {
                let productOfferTemplateByName = {
                    productOfferTemplateId : uuidv4(),
                    providerId : userId,
                    productName,
                    price ,
                    appId
                }
                Object.keys(reqBody).map((key, index, array) => {
                    productOfferTemplateByName[key] = reqBody[key]
                });
                console.log("productOfferTemaplteName" , productOfferTemplateByName);
                dynamoOperations.saveProductOfferingsTemplate(productOfferTemplateByName);
            }
            //await dynamoOperations.saveProductOfferings(productOffering);
            //return createResponse(200, { "message": "Product offering successfully added", productOffering:productOffering });
        }
        console.log("product offering is ", productOffering);
        await dynamoOperations.saveProductOfferings(productOffering);
        return createResponse(200, { "message": "Product offering successfully added", productOffering:productOffering });
    } else {
        return createResponse(400, { "message": "User Does not exists" });
    }
}



module.exports.updateOffering = async (event, context) => {
    let reqBody = JSON.parse(event.body);
    let { phoneNumber, userId , productName,price } = reqBody;
    let { productOfferingId } = event.pathParameters

    if (!phoneNumber || !userId || !productName || !price) {
        return createResponse(400, { "message": "phoneNumber ,  UserId  Missing" });
    }

    let checkPhoneNumber = isPhoneNumberValid(phoneNumber);
    if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
        return createResponse(400, { "message": "phoneNumber not valid!" });
    }


    let productOfferingItem = await dynamoOperations.findProductsOfferingById(productOfferingId);
    
    console.log("productOffering", productOfferingItem , productOfferingItem.Items[0].userId);
    if (userId === productOfferingItem.Items[0].userId && productOfferingItem.Count > 0) {
        let productOffering = {
            productOfferingId,
            userId,
            productName,
            price
        }
        let queryExp = "set "
        Object.keys(reqBody).map((key, index, array) =>{
            if(key!=="productOfferingId") {
                queryExp += key + "=:" + key + "," //params.Item[key] = req.body[key]
            }
        })
        queryExp = queryExp.slice(0, queryExp.lastIndexOf(","))
        let params = {
            Key:{
                "productOfferingId": productOfferingId,
            },
            UpdateExpression: queryExp,
            ExpressionAttributeValues:{},
        };
        Object.keys(reqBody).map((key, index, array) =>{
            if(key!=="productOfferingId") {
                params.ExpressionAttributeValues[":" + key] = reqBody[key]//params.Item[key] = req.body[key]
            }
        })

        productOffering = await dynamoOperations.updateProductOfferings(params);
        return createResponse(200, { "message": "Product offering successfully Updated", productOffering:productOffering.Attributes});

    } else {
        return createResponse(400, { "message": "Product Offering does  not exists" });
    }
}

module.exports.getOffering = async (event, context) => {

    let { productOfferingId } = event.pathParameters

    if (!productOfferingId) {
        return createResponse(400, { "message": "productOfferingId  Missing" });
    }


    let productOfferingItem = await dynamoOperations.findProductsOfferingById(productOfferingId);

    console.log("userhjskdh", productOfferingItem , productOfferingItem.Items);
    if (productOfferingItem && productOfferingItem.Count > 0) {
        return createResponse(200, { "offering": productOfferingItem.Items[0] });

    } else {
        return createResponse(400, { "message": "Product Offering does  not exists" });
    }
}

module.exports.getTemplatesByProvider = async (event, context) => {

    let { providerId } = event.pathParameters

    if (!providerId) {
        return createResponse(400, { "message": "providerId  Missing" });
    }


    let productOfferingItem = await dynamoOperations.findProviderProductOfferingTemplates(providerId);

    console.log("templates", productOfferingItem , productOfferingItem.Items);
    if (productOfferingItem && productOfferingItem.Count > 0) {
        return createResponse(200, { "offeringTemplates": productOfferingItem.Items });

    } else {
        return createResponse(200, { "message": "Product Offering templates does not exists for provider - "+ providerId, offeringTemplates:[] });
    }
}










// Get Product offers using userId

module.exports.getOfferingByUserId = async (event, context) => {
    let { userId } = event.pathParameters;
    console.log("event is ", userId);
    if (!userId) {
        return createResponse(400, { "message": "userId Missing" });
    }
    let user = await dynamoOperations.findUserById(userId)
    if(!user || user.Count===0){
        return createResponse(400, { "message": "User does not exist" });
    }
    else {
        let productOfferingItem = await dynamoOperations.findProductsOfferingByUserId(userId);
        return createResponse(200, productOfferingItem.Items);

    }
}
