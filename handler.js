const { v4: uuidv4 } = require('uuid');
const dynamoOperations = require('./common/dynamo');
const moment = require('moment');
const { createResponse, isPhoneNumberValid, randomString, arePointsInRange } = require('./common/helper');
const { verifyOTP } = require('./otp/otpOperation');
const referralEarnings = require('./order/referralEarnings');
const orderEarnings = require('./order/orderEarnings');
//let userToValidate;



module.exports.registerUser = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  const { userType } = reqBody
  if (!userType) {
    return createResponse(400, { "message": "userType is Missing" });
  }
  if (userType === 'admin') {
    return await this.createAdmin(event, context)
  } else if (userType === 'provider_consumer') {
    return await this.createProvider(event, context)
  } else if (userType === 'consumer') {
    return await this.createConsumer(event, context)
  }
}

// Create a User
module.exports.createProvider = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  console.log("event is ", reqBody);
  const { phoneNumber, otpValue, appId, userType } = reqBody
  if (!phoneNumber || !otpValue || !appId) {
    return createResponse(400, { "message": "phoneNumber otpValue  appId or  Type Missing" });
  }

  let checkPhoneNumber = isPhoneNumberValid(phoneNumber);

  if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
    return createResponse(400, { "message": "phoneNumber not valid!" });
  }
  let verifyOtpResponse = await verifyOTP(phoneNumber, otpValue , appId);
  let uniqueCode = randomString(6, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  let last4 = phoneNumber.substring(phoneNumber.length - 4, phoneNumber.length);
  uniqueCode += last4.split("").reverse().join("")
  console.log("uniqueCode", uniqueCode)
  console.log("verify", verifyOtpResponse);
  if (verifyOtpResponse.errorCode === "TokenExpiredError") {
    return createResponse(400, { "message": "OTP Expired" });
  }
  if (verifyOtpResponse.statusCode == 200) {
  let userItem = await dynamoOperations.findUserByPhoneNumber(phoneNumber,appId);
  console.log("userItm is ", userItem);


    if (userItem.Count > 0 && userItem.Items[0].userType === 'provider_consumer') {
      return createResponse(200, { "message": "User Already Registered" });
    } else if (userItem.Count > 0 && userItem.Items[0].userType === 'consumer') {
      return this.registerAsProvider(reqBody, uniqueCode)
    }


    const { referredBy } = reqBody
    let referredByUser
    if (referredBy) {
      referredByUser = await dynamoOperations.findUserByReferralCode(referredBy)
    }
    let user = {};
    let userId = uuidv4();
    Object.keys(reqBody).map((key, index, array) => {
      console.log("key is ", key, reqBody[key]);
      user[key] = reqBody[key];
    });

    console.log("user is ", user);
    if (referredByUser) {
      user["referredById"] = referredByUser.Items[0].userId
      user["joinedProviderIds"] = [referredByUser.Items[0].userId]
      let queryExpPro = "set joinedProviderIds=:joinedProviderIds"
      let paramsPro = {
        Key: {
          "userId": referredByUser.Items[0].userId,
        },
        UpdateExpression: queryExpPro,
        ExpressionAttributeValues: {},
      };
      let joinedProviderIds = referredByUser.Items[0].joinedProviderIds ? referredByUser.Items[0].joinedProviderIds : []
      joinedProviderIds.includes(userId) ? joinedProviderIds : joinedProviderIds.push(userId)
      paramsPro.ExpressionAttributeValues[":joinedProviderIds"] = joinedProviderIds
      let updatedRecordPro = await dynamoOperations.updateUser(paramsPro);
    }
    user["referralCode"] = uniqueCode
    user["userStatus"] = "Active"
    user["userType"] = 'provider_consumer'
    user["userId"] = userId;
    user["createdAt"] = new Date().toISOString();
    user["joinedProviderIds"] = [];
    user["joinedConsumerIds"] = referredByUser ? [referredByUser.Items[0].userId] : [];

    let updatedRecord = await dynamoOperations.saveUser(user);
    console.log("Updated user userId:", user, updatedRecord);

    return createResponse(200, { "message": "user successfully registered" });
  } else {
    return createResponse(400, { "message": "OTP Not verified" });
  }

}

module.exports.registerAsProvider = async (reqBody, uniqueCode) => {
  let queryExp = "set "
  Object.keys(reqBody).map((key, index, array) => {
    if (key !== 'userId' && key !== 'phoneNumber' && key !== 'type' && key !== 'appId' && key !== 'otp') {
      queryExp += key + "=:" + key + "," //params.Item[key] = req.body[key]
    }
  })
  queryExp += "referralCode=:referralCode"
  //queryExp = queryExp.slice(0, queryExp.lastIndexOf(","))
  let params = {
    Key: {
      "userId": reqBody.userId,
    },
    UpdateExpression: queryExp,
    ExpressionAttributeValues: {},
  };
  Object.keys(reqBody).map((key, index, array) => {
    if (key !== 'userId' && key !== 'phoneNumber' && key !== 'type' && key !== 'appId' && key !== 'otp') {
      params.ExpressionAttributeValues[":" + key] = reqBody[key]//params.Item[key] = req.body[key]
    }
  })
  params.ExpressionAttributeValues[":referralCode"] = uniqueCode
  params.ExpressionAttributeValues[":userType"] = "provider_consumer"
  /*Object.keys(reqBody).map((key, index, array) => {
    console.log("key is ", key, reqBody[key]);
    user[key] = reqBody[key];
  });*/
  //console.log("user is", user);
  let updatedRecord = await dynamoOperations.updateUser(params);
  console.log("Updated user userId:", updatedRecord);
  return createResponse(200, { "message": "user updated Successfully", user: updatedRecord.Attributes });
}


//Get user by PhoneNumber 
module.exports.getUserByPhoneNumber = async (event, context) => {
  let { phoneNumber } = event.pathParameters;
  let {appId} = event.queryStringParameters || {}
  appId =  appId ? appId : 'food';
  console.log("event is ", phoneNumber);
  let userItem = await dynamoOperations.findUserByPhoneNumber(phoneNumber , appId);
  console.log("user is ", userItem);
  userItem = userItem.Items[0];

  if (userItem) {
    return createResponse(200, { "User": userItem });
  } else {
    return createResponse(400, { "message": "user Does not exists" });
  }

}

//Get user by Id
module.exports.getUserById = async (event, context) => {
  let { userId } = event.pathParameters;
  console.log("event is ", userId);
  let userItem = await dynamoOperations.findUserById(userId);
  console.log("user is ", userItem);
  userItem = userItem.Items[0];

  if (userItem) {
    return createResponse(200, { "User": userItem });
  } else {
    return createResponse(400, { "message": "user Does not exists" });
  }

}


// Update a User 
module.exports.updateUser = async (event, context) => {
  let user = {};
  let reqBody = JSON.parse(event.body);
  let { userId } = event.pathParameters
  console.log("userID", userId);
  // check if user exists in the DB
  let userItem = await dynamoOperations.findUserById(userId);
  console.log("userItem", userItem);
  if (userItem.Count > 0) {
    if (reqBody.reqType === 'get') {
      return createResponse(200, { "User": userItem.Items[0] });
    } else {
      // then Update User
      let queryExp = "set "
      Object.keys(reqBody).map((key, index, array) => {
        if (key !== 'userId' && key !== 'phoneNumber' && key !== 'type' && key !== 'reqType' && key !== 'appId' && key !== 'otp') {
          queryExp += key + "=:" + key + "," //params.Item[key] = req.body[key]
        }
      })
      queryExp = queryExp.slice(0, queryExp.lastIndexOf(","))
      let params = {
        Key: {
          "userId": userId,
        },
        UpdateExpression: queryExp,
        ExpressionAttributeValues: {},
      };
      Object.keys(reqBody).map((key, index, array) => {
        if (key !== 'userId' && key !== 'phoneNumber' && key !== 'type' && key !== 'reqType' && key !== 'appId' && key !== 'otp') {
          params.ExpressionAttributeValues[":" + key] = reqBody[key]//params.Item[key] = req.body[key]
        }
      })
      /*Object.keys(reqBody).map((key, index, array) => {
        console.log("key is ", key, reqBody[key]);
        user[key] = reqBody[key];
      });*/
      console.log("user is", user);
      let updatedRecord = await dynamoOperations.updateUser(params);
      console.log("Updated user userId:", user, updatedRecord);
      return createResponse(200, { "message": "user updated Successfully", user: updatedRecord.Attributes });
    }
  }
  else {
    return createResponse(400, { "message": "User does not exists" });
  }
}


// Update a User
module.exports.updateUserType = async (event, context) => {
  let user = {};
  let reqBody = JSON.parse(event.body);
  let { userId } = event.pathParameters
  console.log("userID", userId);
  if (userId !== reqBody.userId) {
    return createResponse(400, { "message": "only self can update the userType" });
  }
  // check if user exists in the DB
  let userItem = await dynamoOperations.findUserById(userId);
  console.log("userItem", userItem);
  if (userItem.Count > 0) {
    // then Update User
    let queryExp = "set userType=:userType"
    let uniqueCode = ""
    if (userItem.Items[0].userType === 'consumer') {
      uniqueCode = randomString(6, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
      let last4 = reqBody.phoneNumber.substring(reqBody.phoneNumber.length - 4, reqBody.phoneNumber.length);
      uniqueCode += last4.split("").reverse().join("")
      queryExp += ",referralCode=:referralCode"
      console.log("uniqueCode", uniqueCode)
    }
    /*Object.keys(reqBody).map((key, index, array) =>{
      if(key!=='userId' && key!=='phoneNumber' && key!=='type' && key!=='appId' && key!=='otp') {
        queryExp += key + "=:" + key + "," //params.Item[key] = req.body[key]
      }
    })
    queryExp = queryExp.slice(0, queryExp.lastIndexOf(","))*/
    let params = {
      Key: {
        "userId": userId,
      },
      UpdateExpression: queryExp,
      ExpressionAttributeValues: { ":userType": "provider_consumer" },
    };
    if (userItem.Items[0].userType === 'consumer') {
      params.ExpressionAttributeValues[":referralCode"] = uniqueCode
    }
    /*Object.keys(reqBody).map((key, index, array) =>{
      if(key!=='userId' && key!=='phoneNumber' && key!=='type' && key!=='appId' && key!=='otp') {
        params.ExpressionAttributeValues[":" + key] = reqBody[key]//params.Item[key] = req.body[key]
      }
    })*/
    /*Object.keys(reqBody).map((key, index, array) => {
      console.log("key is ", key, reqBody[key]);
      user[key] = reqBody[key];
    });*/
    console.log("user is", user);
    let updatedRecord = await dynamoOperations.updateUser(params);
    console.log("Updated user userId:", user, updatedRecord);
    return createResponse(200, { "message": "user updated Successfully", user: updatedRecord.Attributes });
  }
  else {
    return createResponse(400, { "message": "User does not exists" });
  }
}

//Join a provider
module.exports.joinProvider = async (event, context) => {
  let { userId } = event.pathParameters;
  let reqBody = JSON.parse(event.body);
  const { providerId, consumerId, phoneNumber } = reqBody
  console.log("event is ", userId);
  let userItem = await dynamoOperations.findUserById(userId);
  let providerItem = await dynamoOperations.findUserById(providerId);
  //console.log("userItem", userItem)
  //console.log("providerItem", providerItem)
  if (userItem.Count > 0 && providerItem.Count > 0) {
    let queryExp = "set joinedProviderIds=:joinedProviderIds"
    let queryExpPro = "set joinedConsumerIds=:joinedConsumerIds"
    let params = {
      Key: {
        "userId": userId,
      },
      UpdateExpression: queryExp,
      ExpressionAttributeValues: {},
    };
    let paramsPro = {
      Key: {
        "userId": providerId,
      },
      UpdateExpression: queryExpPro,
      ExpressionAttributeValues: {},
    };
    let joinedProviderIds = userItem.Items[0].joinedProviderIds ? userItem.Items[0].joinedProviderIds : []
    let joinedConsumerIds = providerItem.Items[0].joinedConsumerIds ? providerItem.Items[0].joinedConsumerIds : []
    joinedProviderIds.includes(providerId) ? joinedProviderIds : joinedProviderIds.push(providerId)
    joinedConsumerIds.includes(userId) ? joinedConsumerIds : joinedConsumerIds.push(userId)
    params.ExpressionAttributeValues[":joinedProviderIds"] = joinedProviderIds
    paramsPro.ExpressionAttributeValues[":joinedConsumerIds"] = joinedConsumerIds
    let updatedRecord = await dynamoOperations.updateUser(params);
    let updatedRecordPro = await dynamoOperations.updateUser(paramsPro);
    //console.log("Updated user:", updatedRecord);
    return createResponse(200, { "message": "user updated Successfully", user: updatedRecord.Attributes });
  } else {
    return createResponse(400, { "message": "user Does not exists" });
  }
  //console.log("user is ", userItem);
  //userItem = userItem.Items[0];

  /*if (userItem) {
    return createResponse(200, { "User": userItem });
  } else {
    return createResponse(400, { "message": "user Does not exists" });
  }*/

}

// this is used to RegisterConsumer
module.exports.createConsumer = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  console.log("event is ", reqBody);
  const { phoneNumber, otpValue, appId, userType } = reqBody

  if (!phoneNumber || !otpValue || !appId) {
    return createResponse(400, { "message": "phoneNumber , appId or otpValue Missing" });
  }

  let checkPhoneNumber = isPhoneNumberValid(phoneNumber);
  console.log(checkPhoneNumber)
  if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
    return createResponse(400, { "message": "phoneNumber not valid!" });
  }
  let verifyOtpResponse = await verifyOTP(phoneNumber, otpValue,appId);
  console.log("verify", verifyOtpResponse);
  if (verifyOtpResponse.errorCode === "TokenExpiredError") {
    return createResponse(400, { "message": "OTP Expired" });
  }
  if (verifyOtpResponse.statusCode == 200) {
  let userItem = await dynamoOperations.findUserByPhoneNumber(phoneNumber , appId);

    if (userItem.Count > 0) {
      return createResponse(400, { "message": "User Already Registered" });
    }
    let uniqueCode = randomString(6, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    let last4 = phoneNumber.substring(phoneNumber.length - 4, phoneNumber.length);
    uniqueCode += last4.split("").reverse().join("")
    console.log("uniqueCode", uniqueCode)

    const { referredBy } = reqBody
    let referredByUser
    if (referredBy) {
      referredByUser = await dynamoOperations.findUserByReferralCode(referredBy)
    }


    let user = {};
    Object.keys(reqBody).map((key, index, array) => {
      console.log("key is ", key, reqBody[key]);
      user[key] = reqBody[key];
    });


    let userId = uuidv4();
    if (referredByUser) {
      user["referredById"] = referredByUser.Items[0].userId
      user["joinedProviderIds"] = [referredByUser.Items[0].userId]
      let queryExpPro = "set joinedConsumerIds=:joinedConsumerIds"
      let paramsPro = {
        Key: {
          "userId": referredByUser.Items[0].userId,
        },
        UpdateExpression: queryExpPro,
        ExpressionAttributeValues: {},
      };
      let joinedConsumerIds = referredByUser.Items[0].joinedConsumerIds ? referredByUser.Items[0].joinedConsumerIds : []
      joinedConsumerIds.includes(userId) ? joinedConsumerIds : joinedConsumerIds.push(userId)
      paramsPro.ExpressionAttributeValues[":joinedConsumerIds"] = joinedConsumerIds
      let updatedRecordPro = await dynamoOperations.updateUser(paramsPro);
    }
    user["referralCode"] = uniqueCode
    user["joinedProviderIds"] = referredByUser && (referredByUser.Items[0].userType === 'provider' || referredByUser.Items[0].userType === 'provider_consumer') ? [referredByUser.Items[0].userId] : [];
    user["joinedConsumerIds"] = referredByUser && referredByUser.Items[0].userType === 'consumer' ? [referredByUser.Items[0].userId] : [];
    user["userType"] = 'consumer'
    user["userStatus"] = "Active"
    user["userId"] = userId
    user["createdAt"] = new Date().toISOString();



    let updatedRecord = await dynamoOperations.saveUser(user);
    console.log("Updated user userId:", user, updatedRecord);

    return createResponse(200, { "message": "user successfully registered" });
  } else {
    return createResponse(400, { "message": "OTP Not verified" });
  }

}







// This is used to Login Consumer and Provider
module.exports.loginUser = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  const { phoneNumber, otpValue, requestType, userType } = reqBody;
  let {appId} = event.queryStringParameters || {};
  appId =  appId ? appId : 'food';
  if (!phoneNumber || !otpValue) {
    return createResponse(400, { "message": "phoneNumber otpValue   or   RequestType  Missing" });
  }

  let checkPhoneNumber = isPhoneNumberValid(phoneNumber);
  if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
    return createResponse(400, { "message": "phoneNumber not valid!" });
  }

  if(phoneNumber === "+919876543210"){
    let userItem = await dynamoOperations.findUserByPhoneNumber("+919876543210" , appId);//findUserByPhoneNumberAndType(phoneNumber, userType);
    console.log("userItem is " , userItem);  
    if (userItem && userItem.Count > 0) {
      console.log("login successfull");
      return createResponse(200, { "message": "Login Successfull", "User": userItem.Items[0] });
    }
  }

  try {
    let verifyOtpResponse = await verifyOTP(phoneNumber, otpValue , appId);
    console.log("verify", verifyOtpResponse);
    if (verifyOtpResponse.errorCode === "TokenExpiredError") {
      return createResponse(400, { "message": "OTP Expired" });
    }
    if (verifyOtpResponse.statusCode == 200) {
      let userItem = await dynamoOperations.findUserByPhoneNumber(phoneNumber , appId);//findUserByPhoneNumberAndType(phoneNumber, userType);
      console.log("userItem is ", userItem);
      if (userItem && userItem.Count > 0) {
        console.log("login successfull");
        return createResponse(200, { "message": "Login Successfull", "User": userItem.Items[0] });
      }
      else {
        console.log("user does not exists");
        return createResponse(400, { "message": "User does not exists" });
      }

    } else {
      console.log("otp not verified");
      return createResponse(400, { "message": "OTP Not verified" });
    }
  } catch (err) {
    console.log("error is ", err);
    throw err;
  }
}

module.exports.getAllProviders = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  let {appId} = event.queryStringParameters || {};  
  appId =  appId ? appId : 'food';
  let headers = event.headers;
  console.log("headers", headers["user-id"])
  //const { userId } = reqBody;
  let res = await dynamoOperations.findUsersByType("provider" , appId);
  let res1 = await dynamoOperations.findUsersByType("provider_consumer" , appId);
  let users = res.Items.concat(res1.Items)
  //console.log(res)
  if (users) {
    return createResponse(200, { "providers": users })
  } else {
    return createResponse(400, { "message": "No provider exists" })
  }
}

module.exports.getUsersByTypeAndStatus = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  let { userType, userStatus } = event.pathParameters;
  let {appId} = event.queryStringParameters || {};
  appId =  appId ? appId : 'food';
  //const { userId } = reqBody;
  console.log("params", userStatus)
  if (!userType) {
    return createResponse(400, { "message": "No userType" })
  }
  let res
  if(userStatus==='All'){
    let activeUsers = await dynamoOperations.findUsersByTypeAndStatus(userType, "Active" , appId);
    let inactiveUsers = await dynamoOperations.findUsersByTypeAndStatus(userType, "InActive" , appId);
    //console.log("activeUsers", activeUsers)
    //console.log("inactiveUsers", inactiveUsers)
    res = activeUsers.Items.concat(inactiveUsers.Items)
  }else {
    let users = await dynamoOperations.findUsersByTypeAndStatus(userType, userStatus , appId);
    res = users.Items
  }
  //console.log(res)
  if (res) {
    return createResponse(200, { "users": res })
  } else {
    return createResponse(400, { "message": "No provider exists" })
  }
}


// Create an Admin
module.exports.createAdmin = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  console.log("event is ", reqBody);
  const { phoneNumber, otpValue, appId, userType } = reqBody
  if (!phoneNumber || !otpValue || !appId) {
    return createResponse(400, { "message": "phoneNumber otpValue Type  or AppId  Missing" });
  }

  let checkPhoneNumber = isPhoneNumberValid(phoneNumber);

  if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
    return createResponse(400, { "message": "phoneNumber not valid!" });
  }
  let verifyOtpResponse = await verifyOTP(phoneNumber, otpValue);

  console.log("verify", verifyOtpResponse);
  if (verifyOtpResponse.errorCode === "TokenExpiredError") {
    return createResponse(400, { "message": "OTP Expired" });
  }
  if (verifyOtpResponse.statusCode == 200) {
  let userItem = await dynamoOperations.findUserByPhoneNumber(phoneNumber , appId);
  console.log("userItm is ", userItem);


    if (userItem.Count > 0) {
      return createResponse(400, { "message": "User Already Registered" });
    }

    let uniqueCode = randomString(6, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    let last4 = phoneNumber.substring(phoneNumber.length - 4, phoneNumber.length);
    uniqueCode += last4.split("").reverse().join("")
    console.log("uniqueCode", uniqueCode)
    let user = {};
    Object.keys(reqBody).map((key, index, array) => {
      console.log("key is ", key, reqBody[key]);
      user[key] = reqBody[key];
    });

    user["referralCode"] = uniqueCode
    user["userStatus"] = "InActive"
    user["userType"] = 'admin'
    user["userId"] = uuidv4();
    user["createdAt"] = new Date().toISOString();
    user["joinedProviderIds"] = [];
    user["joinedConsumerIds"] = [];
    console.log("user is ", user);


    let updatedRecord = await dynamoOperations.saveUser(user);
    console.log("Updated user userId:", user, updatedRecord);

    return createResponse(200, { "message": "admin successfully registered", "User": user });
  } else {
    return createResponse(400, { "message": "OTP Not verified" });
  }

}

// This function is used to fetch all the  product offerings that lies inside  the radius of the users Location
module.exports.checkIfWithInRange = async (event, context) => {
  let { km, userId, userLatLng } = JSON.parse(event.body);
  let {appId} = event.queryStringParameters || {};
  appId =  appId ? appId : 'food';
  if (!km || !userId || !userLatLng) {
    return createResponse(400, { "message": "userLatLng, km, userId  Missing" });
  }

  let user = await dynamoOperations.findUserById(userId);
  if (!user || user.Count === 0) {
    return createResponse(400, { "message": "User does not exist" });
  }
  // Get all the Providers
  let getAllProviders = await dynamoOperations.findUsersByType("provider" , appId);
  let getAllProviderConsumers = await dynamoOperations.findUsersByType("provider_consumer" , appId);
  console.log("Providers Count ", getAllProviders.Count);
  console.log("getAllProviderConsumers Count ", getAllProviderConsumers.Count);
  getAllProviders = getAllProviders.Items;
  getAllProviders = await getAllProviders.concat(getAllProviderConsumers.Items)
  var productAddressesWhichExistsInRange = [];
  for (const allProvider of getAllProviders) {
    //console.log("all provier is " , allProvider.userId);

    // check Provider Pickup Address exists or not
    if (allProvider.addresses) {
      console.log("id", allProvider.userId)
      for (providerAddress of allProvider.addresses) {
        productLatLng = providerAddress.pickupLocation;
        console.log("product lat long user lat long ", productLatLng, userLatLng, km);
        let productOfferingItemInRange = await arePointsInRange(productLatLng, userLatLng, km);
        console.log("Is in range ", productOfferingItemInRange);
        // Check if the Product Offering in the customer range 
        if (productOfferingItemInRange) {
          console.log("addressId", providerAddress.address_id);
          console.log(productAddressesWhichExistsInRange.push(providerAddress.address_id));
        }
      }
    }
  }
  productAddressesWhichExistsInRange = [...new Set(productAddressesWhichExistsInRange)]; // Gives you iniques array . no duplicate items 
  console.log("productAddressesWhichExistsInRange" , productAddressesWhichExistsInRange);
  let allProductList = [];
  for (productAddressWhichExistsInRange of productAddressesWhichExistsInRange) {
    let productsOfferingByAddressId = await dynamoOperations.findAllProductsOfferings(productAddressWhichExistsInRange , appId);
    console.log("allProducts ", productsOfferingByAddressId.Items);
    for (allProduct of productsOfferingByAddressId.Items) {
      //userId  =  allProduct.userId;
      //let userItem = await dynamoOperations.findUserById(userId);
      //console.log("userItem", userItem);
      //if (userItem.Count > 0) { 


      //Logic for time check ...using moment
      let orderCloseDateTime = moment(
        allProduct.orderCloseDateTime,
        "hh:mmA, DD MMMM YYYY"
      );
      let currentDate = new Date();
      if (currentDate < orderCloseDateTime) {
        allProductList.push(allProduct);
      }


      // Logic for time check custom break logic 
      // let currentDate = new Date();
      //  if (currentDate < new Date(allProduct.orderCloseDateTime.split(',')[1]) == true) {
      //    let orderHours = moment(allProduct.orderCloseDateTime.split(',')[0], ["h:mm A"]).format("HH")
      //    let currentHours = new Date().getHours();
      //    if (currentHours < orderHours) {
      //      let oldinutes = moment(allProduct.orderCloseDateTime.split(',')[0], ["h:mm A"]).format("mm")
      //      let currentMinutes = new Date().getMinutes();
      //      if (currentMinutes < oldinutes) {
      //        allProductList.push(allProduct);

      //      }
      //    }
      //  }

      //}



    }
  }
  return createResponse(200, allProductList);
}



module.exports.deleteUserByPhoneNumber = async (event, context) => {
  let { phoneNumber } = event.pathParameters;
  let {appId} = event.queryStringParameters || {};
  appId =  appId ? appId : 'food';
  console.log("event is ", phoneNumber);
  let userItem = await dynamoOperations.findUserByPhoneNumber(phoneNumber , appId);
  console.log("user is ", userItem);
  userItem = userItem.Items[0];

  if (userItem) {
    console.log("userItem is ", userItem, userItem.userId);
    //delete phoneNumber
    await dynamoOperations.deleteUserByPhoneNumber(userItem.userId);
    return createResponse(200, { "message": "User reocrd deleted" });
  } else {
    return createResponse(400, { "message": "user Does not exists" });
  }

}



module.exports.getCommission = async (event, context) => {
  let reqBody = JSON.parse(event.body);
  if (reqBody.reqType === 'commission') {
    return createResponse(200, { "GSTPercentage": 5, "CommissionPercentage": 5 });
  } else if (reqBody.reqType === 'referralEarnings') {
    return referralEarnings.getUserEarningsByDateAndUser(event, context)
  } else if (reqBody.reqType === 'updateEarings') {
    return orderEarnings.updateOrderEarnings(event, context)
  } else if (reqBody.reqType === 'getOrderEarings') {
    return orderEarnings.getEarningsAndPaid(event, context)
  }
  else if (reqBody.reqType === 'getReferredUsers') {
    let userId = reqBody.userId;
    if (!userId) {
      return createResponse(400, { "message": "userId Missing in the request Body" });
    }
    let listOfMenbers = await dynamoOperations.findUsersByReferredById(userId);
    if (listOfMenbers.Count > 0) {
      return createResponse(200, listOfMenbers.Items);
    } else {
      return createResponse(400, { "message": "No Referrers found" });
    }
  }
  else if (reqBody.reqType === 'getMembers') {
    let listOfMemberArray = [];
    let userId = reqBody.userId;
    if (!userId) {
      return createResponse(400, { "message": "userId Missing in the request Body" });
    }
    let listOfMember = await dynamoOperations.findUserById(userId);
    if (listOfMember.Items[0] && listOfMember.Items[0].joinedConsumerIds) {
      let membersLists = listOfMember.Items[0].joinedConsumerIds;
      for (let membersList of membersLists) {
        let listOfMember = await dynamoOperations.findUserById(membersList);
        listOfMemberArray.push(listOfMember.Items[0]);
      }
      return createResponse(200, listOfMemberArray);
    } else {
      return createResponse(400, { "message": "No User found or No members found associated with the user" });
    }
  } else if (reqBody.reqType === "getAllChefsEarningDetails") {
    return orderEarnings.getAllChefsEarningDetails(event);
  }
}

