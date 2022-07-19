const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const { USERS_TABLE, PRODUCT_OFFERING_TABLE, OTP_TABLE, ORDER_TABLE, PAYMENT_TABLE, PROVIDER_ORDERS_TABLE, PRODUCT_OFFERING_TEMPLATE_TABLE, REFERRAL_EARNING_TABLE } = process.env;
const saveUser = profile => {
    const params = {
        TableName: USERS_TABLE,
        Item: profile
    };
    return dynamodb.put(params).promise();
}

const updateUser = user => {
    const params = {
        TableName: USERS_TABLE,
        Key: user.Key,
        UpdateExpression:user.UpdateExpression,
        ExpressionAttributeValues:user.ExpressionAttributeValues,
        ReturnValues:"ALL_NEW"
    };
    return dynamodb.update(params).promise();
}

const findUserByPhoneNumber = (phoneNumber,appId) => {
    console.log(phoneNumber,"insite filteruser")
    let params = {
        TableName: USERS_TABLE,
        IndexName: 'phoneNumber-Index',
        KeyConditionExpression: "phoneNumber = :phoneNumber",
        FilterExpression : 'appId = :appId',
        ExpressionAttributeValues: {
            ":phoneNumber": phoneNumber,
            ":appId" : appId
        }
    };
    return dynamodb.query(params).promise();
}

const findUsersByReferredById = userId => {
    let params = {
        TableName: USERS_TABLE,
        IndexName: 'referredById-index',
        KeyConditionExpression: "referredById = :referredById",
        ExpressionAttributeValues: {
            ":referredById": userId
        }
    };
    return dynamodb.query(params).promise();
}

const findUserByPhoneNumberAndType = (phoneNumber,userType , appId) => {
    let params = {
        TableName: USERS_TABLE,
        IndexName: 'phoneNumber-Index',
        KeyConditionExpression: "phoneNumber = :phoneNumber",
        FilterExpression : 'userType = :userType and appId = :appId',
        ExpressionAttributeValues: {
            ":phoneNumber": phoneNumber,
            ":userType": userType,
            ":appId"  : appId
        }
    };
    return dynamodb.query(params).promise();
}


const findUserById = userId => {
    var params = {
        TableName: USERS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId
        }
    };
    return dynamodb.query(params).promise();
}

const findUsersByType = (userType , appId) => {
    console.log("type" , userType);
    let queryParams = {
        TableName : USERS_TABLE,
        IndexName: 'userType-Index',
        KeyConditionExpression: 'userType = :userType',
        FilterExpression : 'appId = :appId',
        ExpressionAttributeValues: {
            ":userType": userType,
            ":appId" : appId
        }
    };
    console.log("queryParams", queryParams)
    return dynamodb.query(queryParams).promise();
}

const findUsersByTypeAndStatus = (userType,userStatus,appId) => {
    let queryParams = {
        TableName : USERS_TABLE,
        IndexName: 'userStatus-Index',
        KeyConditionExpression: 'userStatus = :userStatus',
        FilterExpression : 'begins_with(userType, :userType) and appId = :appId ',
        ExpressionAttributeValues: {
            ":userType": userType,
            ":userStatus":userStatus,
            ":appId" : appId
        }
    };
    console.log("queryParams", queryParams)
    return dynamodb.query(queryParams).promise();
}

const findUserByReferralCode = referralCode => {
    let params = {
        TableName: USERS_TABLE,
        IndexName: 'referralCode-index',
        KeyConditionExpression: "referralCode = :referralCode",
        ExpressionAttributeValues: {
            ":referralCode": referralCode
        }
    };
    return dynamodb.query(params).promise();
}


const saveProductOfferings = productOffering => {
    const params = {
        TableName: PRODUCT_OFFERING_TABLE,
        Item: productOffering
    };
    return dynamodb.put(params).promise();
}

const saveProductOfferingsTemplate = productOfferingTemplate => {
    const params = {
        TableName: PRODUCT_OFFERING_TEMPLATE_TABLE,
        Item: productOfferingTemplate
    };
    return dynamodb.put(params).promise();
}


const findProductOfferingTemplateByName = (productName,providerId , appId) => {
    let params = {
        TableName: PRODUCT_OFFERING_TEMPLATE_TABLE,
        IndexName: 'productName-index',
        KeyConditionExpression: "productName = :productName",
        FilterExpression : 'providerId = :providerId',
        ExpressionAttributeValues: {
            ":productName": productName,
            ":providerId": providerId
        }
    };
    return dynamodb.query(params).promise();
}

const findProviderProductOfferingTemplates = (providerId) => {
    let params = {
        TableName: PRODUCT_OFFERING_TEMPLATE_TABLE,
        IndexName: 'providerId-index',
        KeyConditionExpression: "providerId = :providerId",
        ExpressionAttributeValues: {
            ":providerId": providerId
        }
    };
    return dynamodb.query(params).promise();
}

const updateProductOfferings = productOffering => {
    const params = {
        TableName: PRODUCT_OFFERING_TABLE,
        Key: productOffering.Key,
        UpdateExpression:productOffering.UpdateExpression,
        ExpressionAttributeValues:productOffering.ExpressionAttributeValues,
        ReturnValues:"ALL_NEW"
    };
    return dynamodb.update(params).promise();
}


const findProductsOfferingByUserId = userId => {
    var params = {
        TableName: PRODUCT_OFFERING_TABLE,
        IndexName: 'userId-productName-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression : 'productStatus <> :productStatus',
        ExpressionAttributeValues: {
            ':userId': userId,
            ':productStatus': 'disabled'
        }
    };
    return dynamodb.query(params).promise();
}




const findProductsOfferingById = productOfferingId => {
    var params = {
        TableName: PRODUCT_OFFERING_TABLE,
        KeyConditionExpression: 'productOfferingId = :productOfferingId',
        ExpressionAttributeValues: {
            ':productOfferingId': productOfferingId
        }
    };
    return dynamodb.query(params).promise();
}


const findAllProductsOfferings = (pickUpLocationId , appId) => {
    var params = {
        TableName: PRODUCT_OFFERING_TABLE,
        IndexName: 'pickUpLocationId-index',
        KeyConditionExpression: 'pickUpLocationId = :pickUpLocationId',
        FilterExpression : 'productStatus <> :productStatus and appId  = :appId',
        ExpressionAttributeValues: {
            ':productStatus': 'disabled',
            ':pickUpLocationId' : pickUpLocationId,
            ':appId' : appId
        }
    };
    return dynamodb.query(params).promise();
}


function saveToken(phoneNumber, token, providerName, msgStatus , appId) {
    var params = {
        TableName: OTP_TABLE,
        Item:{
            phoneNumber,
            token,
            providerName,
            msgStatus,
            appId
        }
    };
    return dynamodb.put(params).promise();   
}

function getToken(phoneNumber , appId) {
    var params = {
        TableName:OTP_TABLE,
        IndexName: 'appId-index',
        KeyConditionExpression: 'appId = :appId',
        FilterExpression : 'phoneNumber = :phoneNumber',
        ExpressionAttributeValues: {
            ':phoneNumber': phoneNumber,
            ':appId'  : appId
        }
    };
    return dynamodb.query(params).promise();
}

function saveOrder(order){
    let params = {
        TableName:ORDER_TABLE,
        Item: order
    }

    return dynamodb.put(params).promise()
}

function updateOrder(userOrderId , providerId , orderStatus){
    const params = {
        TableName: PROVIDER_ORDERS_TABLE,
        Key: {
            "orderId" : userOrderId,
            "providerId" : providerId
        },
        UpdateExpression:'set orderStatus = :orderStatus',
        ExpressionAttributeValues:{
            ':orderStatus': orderStatus,
        },
        ReturnValues:"ALL_NEW"
    };

    return dynamodb.update(params).promise()
}

const findOrderById = orderId => {
    var params = {
        TableName: ORDER_TABLE,
        KeyConditionExpression: 'orderId = :orderId',
        ExpressionAttributeValues: {
            ':orderId': orderId
        }
    };
    return dynamodb.query(params).promise();
}


const findOrderByRazorPayOrderId = razorpayOrderId => {
    var params = {
        TableName: ORDER_TABLE,
        IndexName: 'razorpayOrderId-index',
        KeyConditionExpression: 'razorpayOrderId = :razorpayOrderId',
        ExpressionAttributeValues: {
            ':razorpayOrderId': razorpayOrderId
        }
    };
    return dynamodb.query(params).promise();
}

function updateOrderStatusInOrdersTable(orderId , orderStatus){
    const params = {
        TableName: ORDER_TABLE,
        Key: {
            "orderId" : orderId
        },
        UpdateExpression:'set  #status = :status , orderStatus = :orderStatus',
        ExpressionAttributeValues:{
            ':orderStatus': orderStatus,
            ':status'  : orderStatus
        },
        ExpressionAttributeNames: {
            '#status': 'status'
        },
          
        ReturnValues:"ALL_NEW"
    };

    return dynamodb.update(params).promise()
}

function getProviderOrders(chefId){
    var params = {
        TableName: ORDER_TABLE,
        IndexName: 'productOfferingUserId-index',
        KeyConditionExpression: 'productOfferingUserId = :chefId',
        FilterExpression : 'orderStatus <> :orderStatus',
        ExpressionAttributeValues: {
            ':orderStatus': 'canceled',
            ':chefId' : chefId
        }
    };

    return dynamodb.query(params).promise()
}

function getUserOrders(userId){
    var params = {
        TableName: ORDER_TABLE,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId' : userId
        }
    };

    return dynamodb.query(params).promise()
}

function getAllUserOrderByUserOrderId(userOrderId){
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        IndexName: 'userOrder-index',
        KeyConditionExpression: 'userOrderId = :userOrderId ',
        ExpressionAttributeValues: {
            ':userOrderId' : userOrderId
        }
    };
    return dynamodb.query(params).promise()
}

function getAllOrderByOrderId(orderId){
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        IndexName: 'orderId-index',
        KeyConditionExpression: 'orderId = :orderId ',
        ExpressionAttributeValues: {
            ':orderId' : orderId
        }
    };
    return dynamodb.query(params).promise()
}

function getUserOrderByUserOrderId(userOrderId , providerId){
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        IndexName: 'userOrderId-index',
        KeyConditionExpression: 'userOrderId = :userOrderId and providerId = :providerId ',
        ExpressionAttributeValues: {
            ':providerId'  : providerId,
            ':userOrderId' : userOrderId
        }
    };
    return dynamodb.query(params).promise()
}


function savePaymentDetails(paymentDetails){
    let params = {
        TableName:PAYMENT_TABLE,
        Item: paymentDetails
    }

    return dynamodb.put(params).promise()
}





function fetchPaymentByRazorPayPaymentId(razorPayPaymentId){
    var params = {
        TableName: PAYMENT_TABLE,
        IndexName: 'razorPayPaymentId-index',
        KeyConditionExpression: 'razorPayPaymentId = :razorPayPaymentId',
        ExpressionAttributeValues: {
            ':razorPayPaymentId' : razorPayPaymentId
        }
    };

    return dynamodb.query(params).promise()
}


const changePaymentStatusToCapture = (paymentId) => {
    let paymentStatusChangeRecord = {
       TableName: PAYMENT_TABLE,
       Key: {
        paymentId
        },
       UpdateExpression: 'set #status = :status , captured = :captured',
       ExpressionAttributeValues: {
         ':status': 'captured',
         ':captured' : 'true'
       },
       ExpressionAttributeNames: {
        '#status': 'status'
      },
       ReturnValues: 'UPDATED_NEW'
     };
   
     return paymentStatusChangeRecord;
   }


   const changePaymentStatusToFail = (paymentId) => {
    let paymentStatusChangeRecord = {
       TableName: PAYMENT_TABLE,
       Key: {
        paymentId
        },
       UpdateExpression: 'set #status = :status , captured = :captured',
       ExpressionAttributeValues: {
         ':status': 'failed',
         ':captured' : 'false'
       },
       ExpressionAttributeNames: {
        '#status': 'status'
      },
       ReturnValues: 'UPDATED_NEW'
     };
   
     return paymentStatusChangeRecord;
   }   



const updateRecord = (item) =>{
console.log("inside update record",item);
return (new Promise((resolve,reject)=>{
        
    dynamodb.update(item,function(err,data){
    if(err){
        reject(err);
    }else{
        resolve(item);
        }
    });
}));
}

function saveProviderOrders(order){
    let params = {
        TableName:PROVIDER_ORDERS_TABLE,
        Item: order
    }

    return dynamodb.put(params).promise()
}
  
function getProviderOrdersListBasedonDateRange(providerId ,startDate , endDate){
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        IndexName: "providerId-index",
        KeyConditionExpression: 'providerId = :providerId',
        FilterExpression : 'createdAt between :startDate and :endDate',
        ExpressionAttributeValues: {
            ':providerId' : providerId,
            ':startDate' : startDate,
            ':endDate'  : endDate
        }
    };

    return dynamodb.query(params).promise()
}

function getProviderOrdersListonlyByDate(providerId ,createdAt){
    console.log("dsfsdfdf" , createdAt , providerId)
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        IndexName: "providerId-index",
        KeyConditionExpression: 'providerId = :providerId',
        FilterExpression : 'createdAt = :createdAt', 
        ExpressionAttributeValues: {
            ':providerId' : providerId,
            ':createdAt' : createdAt
         
        }
    };

    return dynamodb.query(params).promise()
}



function getProviderOrdersList(providerId){
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        IndexName: "providerId-index",
        KeyConditionExpression: 'providerId = :providerId',
        ExpressionAttributeValues: {
            ':providerId' : providerId
        }
    };

    return dynamodb.query(params).promise()
}

function getProviderOrder(providerId, orderId){
    var params = {
        TableName: PROVIDER_ORDERS_TABLE,
        KeyConditionExpression: 'providerId = :providerId and orderId:orderId',
        ExpressionAttributeValues: {
            ':providerId' : providerId,
            ':orderId' : orderId
        }
    };

    return dynamodb.query(params).promise()
}

function updateProviderOrderPaidStatus(orderId , providerId ){
    const params = {
        TableName: PROVIDER_ORDERS_TABLE,
        Key: {
            "orderId" : orderId,
            "providerId" : providerId
        },
        UpdateExpression:'set paidStatus = :paidStatus',
        ExpressionAttributeValues:{
            ':paidStatus': 'paid',
        },
        ReturnValues:"ALL_NEW"
    };

    return dynamodb.update(params).promise()
}

function deleteUserByPhoneNumber(userId){
    var params = {
        TableName: USERS_TABLE,
        Key: {
            userId:userId
        }
        };
    return dynamodb.delete(params).promise()
}


function getAllOrders(){
    var params = {
        TableName: ORDER_TABLE,
    };

    return dynamodb.scan(params).promise()
}


function getAllOrdersListBasedonDateRange(startDate , endDate){
    var params = {
        TableName: ORDER_TABLE,
        FilterExpression : 'createdAt between :startDate and :endDate',
        ExpressionAttributeValues: {
            ':startDate' : startDate,
            ':endDate'  : endDate
        }
    };

    return dynamodb.scan(params).promise()
}

function getAllOrdersListonlyByDate(createdAt){
    console.log("dsfsdfdf" , createdAt)
    var params = {
        TableName: ORDER_TABLE,
        FilterExpression : 'createdAt = :createdAt', 
        ExpressionAttributeValues: {
            ':createdAt' : createdAt
        }
    };

    return dynamodb.scan(params).promise()
}


function saveReferralEarnings(referralEarnings){
    let params = {
        TableName:REFERRAL_EARNING_TABLE,
        Item: referralEarnings
    }

    return dynamodb.put(params).promise()
}

function updateReferralOrderStatus(userOrderId , referralEarningId , orderStatus){
    const params = {
        TableName: REFERRAL_EARNING_TABLE,
        Key: {
            "referralEarningId" : referralEarningId,
        },
        UpdateExpression:'set orderStatus = :orderStatus',
        ExpressionAttributeValues:{
            ':orderStatus': orderStatus,
        },
        ReturnValues:"ALL_NEW"
    };

    return dynamodb.update(params).promise()
}

function getReferralEarningsByUser(userId){
    var params = {
        TableName: REFERRAL_EARNING_TABLE,
        IndexName: "userId-index",
        KeyConditionExpression:'userId = :userId',
        ExpressionAttributeValues: {
            ':userId':userId,
        }
    };
    //console.log("referral params", params)
    return dynamodb.query(params).promise()
}

function getReferralEarningsByDate(startDate, endDate, userId , orderStatus){
    var params = {
        TableName: REFERRAL_EARNING_TABLE,
        IndexName: "userId-index",
        KeyConditionExpression:'userId = :userId',
        FilterExpression : 'commissionDate between :startDate and :endDate and orderStatus = :orderStatus',
        ExpressionAttributeValues: {
            ':userId':userId,
            ':startDate' : startDate,
            ':endDate'  : endDate,
            ':orderStatus' : orderStatus
        }
    };
    //console.log("referral params", params)
    return dynamodb.query(params).promise()
}

function getReferralByOrderId(orderId){
    var params = {
        TableName: REFERRAL_EARNING_TABLE,
        IndexName: 'orderId-index',
        KeyConditionExpression: 'orderId = :orderId ',
        ExpressionAttributeValues: {
            ':orderId' : orderId
        }
    };
    return dynamodb.query(params).promise()
}


const updateQunatityofProductOffering = (productOfferingId , servingCount,totalQuantitySold) => {
    const params = {
    TableName: PRODUCT_OFFERING_TABLE,
        Key: {
          "productOfferingId" : productOfferingId
        },
        UpdateExpression: 'set servingCount = :servingCount , totalQuantitySold = :totalQuantitySold',
        ExpressionAttributeValues: {
         ':servingCount': servingCount,
         ':totalQuantitySold' : totalQuantitySold
        },
       ReturnValues: 'UPDATED_NEW'
     };
   
     return dynamodb.update(params).promise()
}

const updatePickedQunatityofProductOffering = (productOfferingId , pickedQuantity,orderStatus) => {
    const params = {
        TableName: PRODUCT_OFFERING_TABLE,
        Key: {
            "productOfferingId" : productOfferingId
        },
        UpdateExpression: 'set pickedQuantity = :pickedQuantity ,orderStatus= :orderStatus',
        ExpressionAttributeValues: {
            ':pickedQuantity': pickedQuantity,
            ':orderStatus':orderStatus
        },
        ReturnValues: 'UPDATED_NEW'
    };

    return dynamodb.update(params).promise()
}



module.exports = {
    saveUser,
    updateUser,
    findUserByPhoneNumber,
    findUserByPhoneNumberAndType,
    findUserById,
    findUserByReferralCode,
    saveProductOfferings,
    findProductsOfferingById,
    findProductsOfferingByUserId,
    findProviderProductOfferingTemplates,
    saveToken,
    getToken,
    findUsersByType,
    findUsersByTypeAndStatus,
    findAllProductsOfferings,
    saveOrder,
    getProviderOrders,
    getUserOrders,
    updateProductOfferings,
    updateOrder,
    findOrderById,
    getUserOrderByUserOrderId,
    getAllUserOrderByUserOrderId,
    getAllOrderByOrderId,
    savePaymentDetails,
    fetchPaymentByRazorPayPaymentId,
    changePaymentStatusToCapture,
    updateRecord,
    saveProviderOrders,
    saveProductOfferingsTemplate,
    findProductOfferingTemplateByName,
    getProviderOrdersList,
    getProviderOrdersListonlyByDate,
    getProviderOrdersListBasedonDateRange,
    deleteUserByPhoneNumber,
    getAllOrders,
    getAllOrdersListonlyByDate,
    getAllOrdersListBasedonDateRange,
    changePaymentStatusToFail,
    findOrderByRazorPayOrderId,
    updateOrderStatusInOrdersTable,
    saveReferralEarnings,
    getReferralEarningsByUser,
    getReferralEarningsByDate,
    getReferralByOrderId,
    updateReferralOrderStatus,
    updateQunatityofProductOffering,
    findUsersByReferredById,
    getProviderOrder,
    updateProviderOrderPaidStatus,
    updatePickedQunatityofProductOffering
}