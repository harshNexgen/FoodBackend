
require('dotenv').config();


const { createResponse, isPhoneNumberValid } = require('../common/helper');
const API_KEY = process.env.MSG91_API_KEY;
const SENDER_ID = process.env.MSG91_SENDER_ID;
const tokenSecret= process.env.MSG91_TOKEN_SECRET;
//const msg91V5=new (require('msg91-v5'))(API_KEY,SENDER_ID,'4');
const otpGenerator = require("otp-generator");
//const msg91SMS=require('msg91-sms');
const jwt = require('jsonwebtoken');
const axios=require('axios');
const dynamoOperations = require('../common/dynamo');
// Send OTP
module.exports.sendOTP = async (event, context) => {
    let providerName = "msg91";
    let reqBody = JSON.parse(event.body);
    let {appId} = event.queryStringParameters || {};
    appId =  appId ? appId : 'food';
    let { phoneNumber , autoReadHash } = reqBody;
    console.log("event is ", reqBody);
    let checkPhoneNumber = isPhoneNumberValid(phoneNumber);
    console.log("checking phhone")
    if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
        return createResponse(400, { "message": "phoneNumber not valid!" });
    }
    if (!phoneNumber) {
        return createResponse(400, { "message": "phoneNumber and appId cannot be empty!" });
    }

    
        let otpToSend = otpGenerator.generate(4, { digits: true, upperCase: false, specialChars: false, alphabets: false });
        console.log("otptosEND",otpToSend);
        let receiver="Customer"
        if(appId=="food"){
        var messageBody={
                flow_id:"6246fa9d8316891c403d7639",
                sender:SENDER_ID,
                mobiles:phoneNumber,
                name:receiver,
                otp:`${otpToSend}`
        }
        }
        else{
            
            var messageBody={
                    flow_id:"6246ff56b2beb219ff67b6d3",
                    sender:SENDER_ID,
                    mobiles:phoneNumber,
                    name:receiver,
                    otp:`${otpToSend}`
            }
           

            
        }
        let token = jwt.sign({ otp: otpToSend }, tokenSecret, { expiresIn: 10000 });
        try {
            await axios({
            url:'https://api.msg91.com/api/v5/flow/',
            method:'post',
            data:messageBody,
            headers:{
              "authkey":API_KEY,
              "Content-Type":"application/json"
            }
            })
            //await msg91V5.sendSMS(options)
            await dynamoOperations.saveToken(phoneNumber, token, providerName, "sent" , appId);
            return createResponse(200, { "message": "OTP Sent" });
        } catch (error) {
            console.log(error)
            return createResponse(500, { "message": "OTP Not Sent" });
        }
      
};


// Verify OTP 

module.exports.verifyOTP = async (phoneNumber, otpValue , appId) => {
    console.log("inside verifyOTP");
    let checkPhoneNumber = isPhoneNumberValid(phoneNumber);
    console.log("checkphonenUMBER", checkPhoneNumber);
    if (checkPhoneNumber && checkPhoneNumber.code == "PHONE_NOT_VALID") {
        return createResponse(400, { "message": "phoneNumber not valid!" });
    }
    let data = await dynamoOperations.getToken(phoneNumber , appId);
    console.log("here is my data",data)
    console.log("data is ", data);
    let token = data.Items[0] && data.Items[0].token;
    //console.log("token is ", token, tokenSecret);
    let decoded;
    try {
        decoded = jwt.verify(token, tokenSecret);     
        let isMatch = decoded && decoded.otp && decoded.otp == otpValue;
        console.log("decoded is ", decoded, otpValue);
        if (isMatch) {
            return createResponse(200, { "message": "OTP Verified" });
        } else {
            return createResponse(400, { "message": "Cannot verify OTP" });
        }
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { statusCode: 400, errorCode: "TokenExpiredError" };
        } else {
            return { statusCode: 400, errorCode: error, message: error.message };
        }

    }
};