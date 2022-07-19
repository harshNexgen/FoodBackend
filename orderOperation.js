
require('dotenv').config()
var rp = require('request-promise');
var sha256 = require('js-sha256');
const { createResponse } = require('./common/helper');
const { placeOrder } = require('./order/order');
const dynamoOperations = require('./common/dynamo');
const { v4: uuidv4 } = require('uuid');



//request Body will be 
// {"amount": 800, "currency": "INR","receipt": "Receipt no. 8","payment_capture": 1}

// This is used to create an OrderId
module.exports.createOrder = async (event, context) => {
    console.log("inside create order");
    //console.log("process.env" , process.env);
    console.log("createOrder", event.body, JSON.parse(event.body));
    let requestBody = JSON.parse(event.body)
    console.log("requestBody is ", requestBody, requestBody.amount);
    let { customerName, customerPhone, deliveryAddress, deviceToken } = requestBody;
    let { appId } = event.queryStringParameters || {};
    appId = appId ? appId : 'food';
    var options = {
        method: 'POST',
        uri: 'https://api.razorpay.com/v1/orders',
        body: { amount: parseInt(requestBody.amount), currency: requestBody.currency, payment_capture: 1 },
        json: true, // Automatically stringifies the body to JSON
        auth: {
            user: process.env.RAZORPAY_KEY_ID,
            pass: process.env.RAZORPAY_SECRET_KEY
        }
    };

    //console.log("options are " , options)

    response = rp(options)
        .then(async function (parsedBody) {
            console.log("parseBody ys ", parsedBody);

            requestBody["razorpayOrderId"] = parsedBody.id
            requestBody["status"] = parsedBody.status;
            if (requestBody.paymentMode === "COD") {
                requestBody["status"] = "COD";
            }
            requestBody["currency"] = parsedBody.currency;
            requestBody["amount"] = parsedBody.amount / 100; // The amount comes in paise 1 rs = 100 paise
            requestBody["customerName"] = customerName;
            requestBody["customerPhone"] = customerPhone;
            requestBody["deliveryAddress"] = deliveryAddress;
            requestBody["deviceToken"] = deviceToken;
            requestBody["appId"] = appId
            console.log("request body is ", requestBody);

            let getOrderDetails = await placeOrder(requestBody);
            getOrderDetails["createdAt"] = new Date().toISOString().substr(0, 10);
            console.log("getOrderDetails are ", getOrderDetails);
            console.log("paymentMode", requestBody.paymentMode);
            if (requestBody.paymentMode === "COD") {
                getOrderDetails["orderStatus"] = "COD";
                getOrderDetails["status"] = "COD";
            }
            let orderResponse = await dynamoOperations.saveOrder(getOrderDetails);
            console.log("Placed Order orderId:", orderResponse);
            return createResponse(200, { "orderDetails": getOrderDetails });
        })
        .catch(function (err) {
            //throw err;
            // POST failed...
            console.log("error is ", err);
            return createResponse(400, { "message": err });
        });
    return response;
}



// Used to fetch order by OrderId 
module.exports.fetchOrder = async (event, context) => {
    let { orderId } = event.pathParameters;
    var options = {
        method: 'GET',
        uri: `https://api.razorpay.com/v1/orders/${orderId}`,
        //body: JSON.parse(event.body),
        json: true, // Automatically stringifies the body to JSON
        auth: {
            user: process.env.RAZORPAY_KEY_ID,
            pass: process.env.RAZORPAY_SECRET_KEY
        }
    };

    response = rp(options)
        .then(function (parsedBody) {
            // POST succeeded...
            return createResponse(200, { "message": "Success", User: parsedBody });
        })
        .catch(function (err) {
            // POST failed...
            return createResponse(400, { "message": err });
        });
    return response;
}



// Fetch Payments for an Order
module.exports.fetchPaymentsforOrder = async (event, context) => {
    console.log("inside fetchPayments for order");
    let { orderId } = event.pathParameters;
    console.log("orderId id ", orderId);
    console.log("event path paramters", event.pathParameters);
    var options = {
        method: 'GET',
        uri: `https://api.razorpay.com/v1/orders/${orderId}/payments`,
        //body: JSON.parse(event.body),
        json: true, // Automatically stringifies the body to JSON
        auth: {
            user: process.env.RAZORPAY_KEY_ID,
            pass: process.env.RAZORPAY_SECRET_KEY
        }
    };

    response = rp(options)
        .then(function (parsedBody) {
            // POST succeeded...
            console.log("success", parsedBody.items);
            return createResponse(200, { "message": "Success", User: parsedBody });
        })
        .catch(function (err) {
            // POST failed...
            console.log("error is ", err);
            return createResponse(400, { "message": err });
        });
    return response;
}




// This is used to check whether the payment is authentic and then save order details in table
module.exports.checkPayment = async (event, context) => {
    try {
        let { appId } = event.queryStringParameters || {};
        appId = appId ? appId : 'food';
        console.log("event is ", event, event.body);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, products } = JSON.parse(event.body);

        console.log("details are", razorpay_order_id, razorpay_payment_id, razorpay_signature);

        let secret = "VZ2v50wlMCr3deDBdWPnPycp";
        let generated_signature = sha256.hmac(secret, razorpay_order_id + "|" + razorpay_payment_id);
        console.log("signature is", generated_signature);
        if (generated_signature == razorpay_signature) {
            // payment is successful
            // change the status from authorized to capture
            let paymentDetails = await fetchPaymentById(razorpay_payment_id);
            paymentDetails = JSON.parse(paymentDetails.body);
            console.log("paymentDetails", paymentDetails);

            paymentDetails.paymentDetails["userId"] = userId;
            paymentDetails.paymentDetails["paymentId"] = uuidv4();
            paymentDetails.paymentDetails["razorPayPaymentId"] = paymentDetails.paymentDetails.id;
            paymentDetails.paymentDetails["amount"] = paymentDetails.paymentDetails.amount / 100;
            paymentDetails.paymentDetails["appId"] = appId
            delete paymentDetails['message'];
            console.log("paymentDetais ", paymentDetails.paymentDetails);
            await dynamoOperations.savePaymentDetails(paymentDetails.paymentDetails);

            let offeringArray = []
            await Promise.all(Object.keys(products).map(async (key) => {
                console.log("key is ", key);
                Object.keys(products[key]).map(async (productOfferingId) => {
                    let offeringStore = {}
                    console.log("key1", productOfferingId);
                    let productOfferingOrderCount = products[key][productOfferingId]['count'];
                    console.log("productOfferingOrderCount", productOfferingOrderCount);
                    offeringStore['offeringId'] = productOfferingId
                    offeringStore['count'] = productOfferingOrderCount
                    offeringArray.push(offeringStore)
                });
            }));
            for (let offering of offeringArray) {
                let productOfferingItem = await dynamoOperations.findProductsOfferingById(offering.offeringId);
                console.log("productOfferingItem", productOfferingItem);
                let totalQuantitySoldBeforeOrder = productOfferingItem.Items[0].totalQuantitySold || 0;
                let totalQuantitySoldAfterOrder = totalQuantitySoldBeforeOrder + offering.count;
                let totalQuantityLeftBeforeOrder = productOfferingItem.Items[0].servingCount;
                let totalQuantityLeftAfterOrder = productOfferingItem.Items[0].servingCount - offering.count;
                console.log("totalQuantity left before order and after order", totalQuantityLeftBeforeOrder, totalQuantityLeftAfterOrder);
                await dynamoOperations.updateQunatityofProductOffering(offering.offeringId, totalQuantityLeftBeforeOrder, totalQuantitySoldAfterOrder);
            }
            return createResponse(200, { "message": "Success", paymentDetails: paymentDetails.paymentDetails });
        } else {
            return createResponse(400, { "message": "payment received is not from an authentic source" });
        }
    } catch (err) {
        console.log("error is", err);
        return createResponse(400, { "message": err });
    }
}

// Used to fetch payment by paymentId 
function fetchPaymentById(paymentId) {
    var options = {
        method: 'GET',
        uri: `https://api.razorpay.com/v1/payments/${paymentId}`,
        //body: JSON.parse(event.body),
        json: true, // Automatically stringifies the body to JSON
        auth: {
            user: process.env.RAZORPAY_KEY_ID,
            pass: process.env.RAZORPAY_SECRET_KEY,
        }
    };

    response = rp(options)
        .then(function (parsedBody) {
            // POST succeeded...
            return createResponse(200, { "message": "Success", "paymentDetails": parsedBody });
        })
        .catch(function (err) {
            // POST failed...
            return createResponse(400, { "message": err });
        });
    return response;
}



// Used to fetch cardDetails for Payment 
module.exports.fetchCardDetailsforPayment = async (event, context) => {
    console.log("inside fetchCardDetailsforPayment");
    let { paymentId } = event.pathParameters;
    var options = {
        method: 'GET',
        uri: `https://api.razorpay.com/v1/payments/${paymentId}/card`,
        //body: JSON.parse(event.body),
        json: true, // Automatically stringifies the body to JSON
        auth: {
            user: process.env.RAZORPAY_KEY_ID,
            pass: process.env.RAZORPAY_SECRET_KEY,
        }
    };

    response = rp(options)
        .then(function (parsedBody) {
            // POST succeeded...
            return createResponse(200, { "message": "Success", "paymentDetails": parsedBody });
        })
        .catch(function (err) {
            // POST failed...
            return createResponse(400, { message: err.error });
        });
    return response;
}




// Webhook Notification events  
module.exports.webhookNotification = async (event, context) => {
    const razorPaySignature = event.headers['X-Razorpay-Signature'];
    console.log("razorPaysignature", razorPaySignature);
    console.log("webhookNotification", JSON.parse(event.body));
    // verfiy if the webhook  coming from correct resource
    let webHookSecretKey = process.env.WEBHOOK_SECRET;
    let body = event.body // raw webhook request body
    console.log("body is ", body);


    let received_signature = razorPaySignature

    let expected_signature = sha256.hmac(webHookSecretKey, body);
    console.log("expected signature is ", expected_signature);
    if (expected_signature !== received_signature) {
        return createResponse(400, { message: "Not validate webhook" });
    } else {
        let webhookBody = JSON.parse(event.body);
        console.log("body is ", webhookBody, webhookBody.event);
        let { id, amount, currency, method, email, contact, order_id, captured } = webhookBody.payload.payment.entity;
        console.log("amount", id, amount, currency, method, email, contact, order_id, captured);
        if (webhookBody.event === "payment.captured") {
            let orderStatus = "captured";
            //check the status of the payment in db 
            console.log("inside captured");
            //get orderStatus and update order status in orders table
            let orderDetails = await dynamoOperations.findOrderByRazorPayOrderId(order_id);
            console.log("orderDetails are ", orderDetails.Items[0]);
            let orderId = orderDetails.Items[0].orderId;
            console.log("orderId", orderId);
            await dynamoOperations.updateOrderStatusInOrdersTable(orderId, orderStatus);
            let allProviderOrder = await dynamoOperations.getAllOrderByOrderId(orderId)
            for (let providerOrder1 of allProviderOrder.Items) {
                if (providerOrder1.orderStatus !== 'picked') {
                    await dynamoOperations.updateOrder(orderId, providerOrder1.providerId, orderStatus);
                }
            }
            await dynamoOperations.updateOrderStatusInOrdersTable(orderId, orderStatus);
            let allReferralOrder = await dynamoOperations.getReferralByOrderId(orderId)
            for (let referralOrder of allReferralOrder.Items) {
                if (referralOrder.orderStatus && referralOrder.orderStatus !== 'picked') {
                    await dynamoOperations.updateReferralOrderStatus(orderId, referralOrder.referralEarningId, orderStatus);
                }
            }
        }
    }
    return createResponse(200, { message: "webhook coming from valid source" });
}





// Used to change the status from of payment authorized to captured
module.exports.capturePayment = async (event, context) => {
    console.log("inside capturePayment");
    let { paymentId } = event.pathParameters;
    var options = {
        method: 'POST',
        uri: `https://api.razorpay.com/v1/payments/${paymentId}/capture`,
        body: JSON.parse(event.body),
        json: true, // Automatically stringifies the body to JSON
        auth: {
            user: process.env.RAZORPAY_KEY_ID,
            pass: process.env.RAZORPAY_SECRET_KEY,
        }
    };

    response = rp(options)
        .then(function (parsedBody) {
            // POST succeeded...
            return createResponse(200, { "message": "Success", "paymentDetails": parsedBody });
        })
        .catch(function (err) {
            // POST failed...
            return createResponse(400, { message: err.error });
        });
    return response;
}

