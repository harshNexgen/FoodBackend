const { v4: uuidv4 } = require('uuid');
const dynamoOperations = require('../common/dynamo');
const { createResponse } = require('../common/helper');
const moment = require('moment');

module.exports.placeOrder = async (reqBody) => {
    console.log("event is ", reqBody);
    //console.log(reqBody.orderId);
    const { razorpayOrderId, status, customerName, customerPhone, deliveryAddress, products, productOfferingIds, userId, deviceToken, appId } = reqBody


    if (!products || !userId || !appId) {
        return createResponse(400, { "message": "userId or products  Missing" });
    }
    try {
        let order = {};
        Object.keys(reqBody).map((key, index, array) => {
            //console.log("key is ", key, reqBody[key]);
            order[key] = reqBody[key];
        });
        order["orderStatus"] = status;
        order["orderId"] = uuidv4();
        order['userId'] = userId;
        //console.log("id",razorpayOrderId)
        order['userOrderId'] = razorpayOrderId.split("").reverse().join("");
        //console.log("order is " , order);
        let consumerUser = await dynamoOperations.findUserById(userId)
        let userCommissionDetails = {}
        let totalPrice = 0
        if (consumerUser.Items[0].referredById) {
            userCommissionDetails['commissionForUserId'] = userId
            userCommissionDetails['commissionForUserType'] = consumerUser.Items[0].userType
            userCommissionDetails['commissionForUserName'] = consumerUser.Items[0].fullName
            //console.log("consumerUser.Items[0]", consumerUser.Items[0])
            userCommissionDetails['userId'] = consumerUser.Items[0].referredById
        }
        let providerCommissionDetailsList = []
        let providersProductsList = []
        await Promise.all(Object.keys(products).map(async (key, index, array) => {
            let providersProducts = {}
            let providerCommissionDetails = {}
            let totalProviderPrice = 0
            let providerUser = await dynamoOperations.findUserById(key)
            //console.log("key is ", key, reqBody[key]);
            providersProducts['providerId'] = key;
            Object.keys(products[key]).map((key1, index, array) => {
                totalProviderPrice = totalProviderPrice + products[key][key1]['price']
                totalPrice = totalPrice + products[key][key1]['price']
            })
            if (providerUser.Items[0].referredById) {
                providerCommissionDetails['userId'] = providerUser.Items[0].referredById;
                console.log("providerUser.Items[0]", providerUser.Items[0])
                providerCommissionDetails['commissionForUserId'] = key;
                providerCommissionDetails['commissionForUserType'] = providerUser.Items[0].userType;
                providerCommissionDetails['commissionForUserName'] = providerUser.Items[0].fullName;
                providerCommissionDetails['totalPrice'] = totalProviderPrice
                providerCommissionDetails['commission'] = ((totalProviderPrice / 100) * 2).toFixed(2)
                providerCommissionDetails['commissionDate'] = new Date().toISOString().substr(0, 10)
                providerCommissionDetails['orderId'] = order["orderId"];
                providerCommissionDetails['orderStatus'] = "created";
                providerCommissionDetails['referralEarningId'] = uuidv4()
                providerCommissionDetails['appId'] = appId
            }
            providersProducts['productOfferingIds'] = products[key];
            providersProducts['orderId'] = order["orderId"];
            providersProducts['userId'] = userId;
            providersProducts['userOrderId'] = order['userOrderId'];
            providersProducts['razorPayOrderID'] = razorpayOrderId;
            providersProducts['orderStatus'] = status;
            providersProducts['createdAt'] = new Date().toISOString().substr(0, 10);

            providersProducts['customerName'] = customerName;
            providersProducts['customerPhone'] = customerPhone;
            providersProducts['deliveryAddress'] = deliveryAddress;
            providersProducts['deviceToken'] = deviceToken;
            providersProducts['appId'] = appId;

            if (providerUser.Items[0].referredById) {
                providerCommissionDetailsList.push(providerCommissionDetails)
                //dynamoOperations.saveReferralEarnings(providerCommissionDetails);
            }
            console.log("prociderProducts is ", providersProducts);
            providersProductsList.push(providersProducts)
            //dynamoOperations.saveProviderOrders(providersProducts);
        }));
        providerCommissionDetailsList.forEach((providerCommissionDetailsListItem) => {
            dynamoOperations.saveReferralEarnings(providerCommissionDetailsListItem);
        })
        providersProductsList.forEach((providersProductsItem) => {
            //console.log("providersProductsList", providersProductsItem)
            dynamoOperations.saveProviderOrders(providersProductsItem);
        });
        if (consumerUser.Items[0].referredById) {
            userCommissionDetails['totalPrice'] = totalPrice
            userCommissionDetails['commission'] = ((totalPrice / 100) * 2).toFixed(2)
            userCommissionDetails['commissionDate'] = new Date().toISOString().substr(0, 10)
            userCommissionDetails['orderId'] = order["orderId"];
            userCommissionDetails['orderStatus'] = status;
            userCommissionDetails['referralEarningId'] = uuidv4()
            userCommissionDetails['appId'] = appId;
            dynamoOperations.saveReferralEarnings(userCommissionDetails);
        }
        if (status && status === "COD") {
            console.log("order is placed using COD");
            let offeringArray = []
            console.log("products are ", products);
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
        }

        //return true ;
        return order;
    } catch (e) {
        console.log("error is ", e);
        return createResponse(500, { "message": e, error: true });
    }
}

module.exports.updateOrder = async (event, context) => {
    let productOfferingStatusArray = [];
    let reqBody = JSON.parse(event.body);
    const { providerId, userOrderId, orderStatus, products } = reqBody;
    if (!userOrderId && !providerId && !orderStatus) {
        return createResponse(400, { "message": "OrderId  or providerId   or orderStatus  is Missing" });
    }
    try {
        console.log("orderId", userOrderId, providerId);
        // Fetching data from ProviderOrder table
        let orderItem = await dynamoOperations.getUserOrderByUserOrderId(userOrderId, providerId);
        console.log("orderItem", orderItem)
        if (orderItem.Count > 0) {
            await Promise.all(Object.keys(products).map(async (key, index, array) => {
                console.log("key is", key); // this is the Product offering id
                let productOfferingDetails = products[key];
                console.log("productOfferingDetails", productOfferingDetails);
                let { orderStatus } = productOfferingDetails;
                console.log("orderStatus is ", orderStatus);
                productOfferingStatusArray.push(orderStatus);
            }));
            let providerOrder = orderItem.Items[0];
            console.log("providerOrder productOfferingIds", providerOrder.productOfferingIds, providerOrder.orderId)
            let pickedOfferingsArray = []
            await Promise.all(Object.keys(providerOrder.productOfferingIds).map(async (productOfferingIdsList, index, array) => {
                let pickedOfferings = {}
                console.log("get productOfferingId", productOfferingIdsList);
                //console.log(" get productOffering details from Id " , providerOrderList.productOfferingIds[productOfferingIdsList]);
                pickedOfferings['offeringId'] = productOfferingIdsList
                pickedOfferings['count'] = providerOrder.productOfferingIds[productOfferingIdsList].count
                pickedOfferings['orderStatus'] = providerOrder.productOfferingIds[productOfferingIdsList].orderStatus
                pickedOfferingsArray.push(pickedOfferings)
            }));

            console.log("OrderItem", orderItem.Items[0].productOfferingIds); // This is the record we are getching from DB
            let getCurrentOfferingFromTable = orderItem.Items[0].productOfferingIds

            for (let offering of pickedOfferingsArray) {
                console.log("products are", products); //This is the productOffering we are getting  in the request

                // find order for particular chef from the providers orders table  and then loop through all the product offering 
                // and if any of them is already picked then don't  increment the count of alreadyPicked
                let offeringId = offering.offeringId;
                console.log("offering id", offeringId);
                let getCurrentOfferingStatusFromTable = getCurrentOfferingFromTable[offeringId].orderStatus;
                console.log(getCurrentOfferingStatusFromTable);
                let getCurrentOfferingStatusFromRequestBody = products[offeringId].orderStatus
                console.log("getCurrentOfferingStatusFromRequestBody , getCurrentOfferingStatusFromTable", getCurrentOfferingStatusFromRequestBody, getCurrentOfferingStatusFromTable);
                if (getCurrentOfferingStatusFromRequestBody === "picked" && getCurrentOfferingStatusFromTable !== "picked") {
                    console.log("inside update quantity");
                    let productOfferingItem = await dynamoOperations.findProductsOfferingById(offering.offeringId);
                    let alreadyPicked = productOfferingItem.Items[0].pickedQuantity || 0
                    let count=alreadyPicked+offering.count;
                    console.log("count alreadyPicked", count + "  " + alreadyPicked)
                    //let price =   providerOrder.productOfferingIds[productOfferingIdsList].price;

                    await dynamoOperations.updatePickedQunatityofProductOffering(offering.offeringId, count,"picked")

                }
            }

            // check all Product offering from the request body and if any of the product offering status is not picked then dont change the orderStatus 
            // else change the Orderstatus to Picked for that single provider order.

            let result = productOfferingStatusArray.every(function (productOfferingStatus) {
                return productOfferingStatus === "picked";
            });

            console.log("result is ", result); // all the items in the array contains Picked 
            if (result) {
                orderItem.Items[0]["productOfferingIds"] = products;
                orderItem.Items[0]["orderStatus"] = "picked";
                console.log("orderItem is", orderItem.Items[0]);
                await dynamoOperations.saveProviderOrders(orderItem.Items[0]);
            } else {
                console.log("all the product offering Status is not picked in the request body");
                orderItem.Items[0]["productOfferingIds"] = products;
                orderItem.Items[0]["orderStatus"] = orderStatus;
                console.log("orderItem is ", orderItem.Items[0]);
                await dynamoOperations.saveProviderOrders(orderItem.Items[0]);
            }


            // Updating Main Order Table
            //  Fetching from ProviderOrder table
            let allProviderOrder = await dynamoOperations.getAllOrderByOrderId(providerOrder.orderId)
            console.log("all Provider are", allProviderOrder);
            //let orderItems = (await allProviderOrder).Items
            let notPicked = false
            for (let providerOrder1 of allProviderOrder.Items) {
                if (providerOrder1.orderStatus !== 'picked') {
                    notPicked = true;
                    break;
                }
            }
            if (notPicked) {//Any of the providerOrder Status is not picked  
                console.log("inside not picked");
                // Updating Orders table
                await dynamoOperations.updateOrderStatusInOrdersTable(providerOrder.orderId, 'partialPicked')
                let allReferralOrder = await dynamoOperations.getReferralByOrderId(providerOrder.orderId)
                for (let referralOrder of allReferralOrder.Items) {
                    if (referralOrder.orderStatus && referralOrder.orderStatus !== 'picked') {
                        await dynamoOperations.updateReferralOrderStatus(providerOrder.orderId, referralOrder.referralEarningId, 'partialPicked');
                    }
                }
            } else {//All of the providerOrder Status picked
                console.log("inside this");
                // Updating Orders table
                await dynamoOperations.updateOrderStatusInOrdersTable(providerOrder.orderId, 'picked')
                let allReferralOrder = await dynamoOperations.getReferralByOrderId(providerOrder.orderId)
                for (let referralOrder of allReferralOrder.Items) {
                    if (referralOrder.orderStatus && referralOrder.orderStatus !== 'picked') {
                        await dynamoOperations.updateReferralOrderStatus(providerOrder.orderId, referralOrder.referralEarningId, 'picked');
                    }
                }
            }

            return createResponse(200, { "message": "order updated successfully", order: orderItem.Items[0] });
        } else {
            return createResponse(400, { "message": "Order does  not exists for the providerId" });
        }
    } catch (error) {
        console.log("error is ", error);
        //return createResponse(500, { "message": JSON.stringify(e), error:true });
    }
}

module.exports.getOrderByUsertype = async (event, context) => {
    let reqBody = JSON.parse(event.body);
    let { userType } = event.pathParameters;
    //const {productOfferingIds, userId, productOfferingUserIds } = reqBody
    if (!userType) {
        return createResponse(400, { "message": "userType Missing" });
    }
    try {
        let orderResponse
        if (userType === 'consumer') {
            orderResponse = await dynamoOperations.getUserOrders(reqBody.userId);
        }
        if (userType === 'provider') {
            orderResponse = await dynamoOperations.getProviderOrders(reqBody.providerId);
        }


        let sortedArray = orderResponse.Items.sort(function (a, b) {
            return moment(b.createdOn, "DD MMMM YYYY, hh:mm:ss.SSSSSS"
            ) - moment(a.createdOn, "DD MMMM YYYY, hh:mm:ss.SSSSSS"
            )
        })
  
        const finallArray={
            Items:sortedArray
        }

        console.log("get orders:", orderResponse);

        return createResponse(200, { "message": "all orders of provider", orders: finallArray });
    } catch (e) {
        return createResponse(500, { "message": e, error: true });
    }
}

module.exports.getOrderById = async (event, context) => {
    //let reqBody = JSON.parse(event.body);
    let { orderId } = event.pathParameters;
    //const {productOfferingIds, userId, productOfferingUserIds } = reqBody
    if (!orderId) {
        return createResponse(400, { "message": "userId or productOfferingIds  Missing" });
    }
    try {
        let orderResponse = await dynamoOperations.findOrderById(orderId);
        console.log("get chef orders:", orderResponse);

        return createResponse(200, { "message": "get order successful", orders: orderResponse.Items });
    } catch (e) {
        return createResponse(500, { "message": e, error: true });
    }
}

module.exports.getUserOrderByUserOrderId = async (event, context) => {
    console.log("inside getUserOrderByUserOrderId ");
    let reqBody = JSON.parse(event.body);
    let { userOrderId } = event.pathParameters;
    const { providerId } = reqBody
    if (!userOrderId && !providerId) {
        return createResponse(400, { "message": "userId or providerId  Missing" });
    }
    try {
        let orderResponse = await dynamoOperations.getUserOrderByUserOrderId(userOrderId, providerId);
        console.log("get chef orders:", orderResponse);

        return createResponse(200, { "message": "get order successful", orders: orderResponse.Items });
    } catch (e) {
        return createResponse(500, { "message": e, error: true });
    }
}



module.exports.getProviderOrderList = async (event, context) => {
    console.log("insdei get providerOrders");

    let { providerId } = event.pathParameters;

    let { startDate, endDate, date } = event.queryStringParameters || {};
    let providerOrderLists;

    console.log("providerId", providerId, startDate, endDate, date);
    if (!providerId) {
        return createResponse(400, { "message": "providerId Missing" });
    }

    if (!date && !startDate && !endDate) {
        providerOrderLists = await dynamoOperations.getProviderOrdersList(providerId);
        console.log("providerOrderList1", providerOrderLists);
    }

    if (startDate && endDate) {  // if there is start date and end date filter based on that 
        providerOrderLists = await dynamoOperations.getProviderOrdersListBasedonDateRange(providerId, startDate, endDate);
        console.log("providerOrderList2", providerOrderLists);
    }


    if (date) {
        providerOrderLists = await dynamoOperations.getProviderOrdersListonlyByDate(providerId, date);
        console.log("providerOrderList3", providerOrderLists);
    }


    let totalEarningOfProviderArray = [];
    let totalCountOfOfferSoldForfProviderArray = [];
    let totalOrderCount = 0;
    for (const providerOrderList of providerOrderLists.Items) {
        if (providerOrderList.orderStatus != 'created' && providerOrderList.orderStatus != 'failed' && providerOrderList.orderStatus != 'captured' && providerOrderList.orderStatus != 'COD') {
            totalOrderCount = totalOrderCount + 1
            console.log("providerOrderListttt", providerOrderList);
            console.log("productOfferingDetail", providerOrderList.productOfferingIds);
            Object.keys(providerOrderList.productOfferingIds).map((productOfferingIdsList, index, array) => {
                console.log(" get productOfferingId ", productOfferingIdsList);
                console.log(" get productOffering details from Id ", providerOrderList.productOfferingIds[productOfferingIdsList]);
                let count = providerOrderList.productOfferingIds[productOfferingIdsList].count;
                let price = providerOrderList.productOfferingIds[productOfferingIdsList].price;

                totalEarningOfProviderArray.push(price);
                totalCountOfOfferSoldForfProviderArray.push(count);

            });
        }
    }
    console.log("Total Orders Provider has got", totalOrderCount);
    let totalEarningOfProvider = totalEarningOfProviderArray.reduce(function (a, b) { return a + b; }, 0);
    let totalCountOfOfferSoldForfProvider = totalCountOfOfferSoldForfProviderArray.reduce(function (a, b) { return a + b; }, 0);
    console.log("Total earning  the provider has done for all orders", totalEarningOfProvider)
    console.log("Total product offerings the Provider has sold", totalCountOfOfferSoldForfProvider);

    return createResponse(200, {
        "message": "Provider Orders List",
        "providerOrderLists": providerOrderLists,
        "totalEarningOfProvider": totalEarningOfProvider,
        "totalCountOfProductOfferingSoldByfProvider": totalCountOfOfferSoldForfProvider,
        "totalProviderOrdersCount": totalOrderCount
    });

}




module.exports.getAllOrdersAndEarning = async (event, context) => {
    console.log("insdei get getAll orders ");

    let { startDate, endDate, date } = event.queryStringParameters || {};
    let allOrdersLists;

    console.log("startDate", startDate, endDate, date);

    if (!date && !startDate && !endDate) {
        allOrdersLists = await dynamoOperations.getAllOrders();
        console.log("providerOrderList1", allOrdersLists);
    }



    if (startDate && endDate) {  // if there is start date and end date filter based on that 
        allOrdersLists = await dynamoOperations.getAllOrdersListBasedonDateRange(startDate, endDate);
        console.log("allOrdersLists2", allOrdersLists);
    }


    if (date) {
        allOrdersLists = await dynamoOperations.getAllOrdersListonlyByDate(providerId, date);
        console.log("allOrdersLists3", allOrdersLists);
    }


    let totalEarningOfProviderArray = [];
    for (const allOrdersList of allOrdersLists.Items) {
        //console.log("allOrdersList" , allOrdersList);
        let price = allOrdersList.amount;
        totalEarningOfProviderArray.push(price);
    }

    console.log("Total Orders Provider has got", allOrdersLists.Count);
    let totalEarningOfProvider = totalEarningOfProviderArray.reduce(function (a, b) { return a + b; }, 0);
    console.log("Total earning  the provider has done for all orders", totalEarningOfProvider / 100)
    return createResponse(200, {
        "message": "Provider Orders List",
        "allOrdersLists": allOrdersLists,
        "totalEarningOfProvider": totalEarningOfProvider / 100,
        "totalProviderOrdersCount": allOrdersLists.Count
    });
}