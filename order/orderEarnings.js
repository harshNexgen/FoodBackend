const { v4: uuidv4 } = require('uuid');
const dynamoOperations = require('../common/dynamo');
const { createResponse } = require('../common/helper')
const {getProviderOrderList} = require('../order/order');
const  referralEarnings  = require('../order/referralEarnings');

module.exports.updateOrderEarnings = async (event, context) => {
    //console.log("inside getUserEarnings ");
    let reqBody = JSON.parse(event.body);
    console.log("reqBody",reqBody)
    const {orders, userId} = reqBody
    if (!userId || !orders) {
        return createResponse(400, { "message": "userId or providerId  Missing" });
    }
    try {
        orders.forEach((order)=>{
            dynamoOperations.updateProviderOrderPaidStatus(order.orderId, userId)
        })
        return createResponse(200, {"message": "paid status updated successfully"});
    }catch(e){
        return createResponse(500, { "message": e, error:true });
    }
}

module.exports.getEarningsAndPaid = async (event, context) => {
    console.log("insde get providerOrders");
    let reqBody = JSON.parse(event.body);
    //let { providerId } = event.pathParameters;

    let { providerId, startDate , endDate , date } = reqBody;
    let providerOrderLists;

    console.log("providerId" ,  providerId  , startDate , endDate , date);
    if (!providerId) {
        return createResponse(400, { "message": "providerId Missing" });
    }

    if(!date && !startDate && !endDate ){
        providerOrderLists = await dynamoOperations.getProviderOrdersList(providerId);
        console.log("providerOrderList1", providerOrderLists);
    }

    if(startDate && endDate) {  // if there is start date and end date filter based on that
        providerOrderLists = await dynamoOperations.getProviderOrdersListBasedonDateRange(providerId , startDate , endDate);
        console.log("providerOrderList2", providerOrderLists);
    }


    if(date){
        providerOrderLists = await dynamoOperations.getProviderOrdersListonlyByDate(providerId , date);
        console.log("providerOrderList3", providerOrderLists);
    }


    let totalEarningOfProviderArray = [];
    let totalCountOfOfferSoldForfProviderArray = [];
    let totalPaidToProviderArray = [];
    for (const providerOrderList of providerOrderLists.Items) {
        //console.log("providerOrderListttt" , providerOrderList);
        //console.log("productOfferingDetail" , providerOrderList.productOfferingIds);
        Object.keys(providerOrderList.productOfferingIds).map((productOfferingIdsList, index, array) => {
            console.log(" get productOfferingId " , productOfferingIdsList);
            console.log(" get productOffering details from Id " , providerOrderList.productOfferingIds[productOfferingIdsList]);
            let count  =  providerOrderList.productOfferingIds[productOfferingIdsList].count;
            let price =   providerOrderList.productOfferingIds[productOfferingIdsList].price;

            totalEarningOfProviderArray.push(price);
            totalCountOfOfferSoldForfProviderArray.push(count);
            if(providerOrderList.paidStatus && providerOrderList.paidStatus==='paid'){
                totalPaidToProviderArray.push(price)
            }
        });
    }
    console.log("Total Orders Provider has got" , providerOrderLists.Count);
    let totalEarningOfProvider = totalEarningOfProviderArray.reduce(function(a, b){return a + b;}, 0);
    let totalCountOfOfferSoldForfProvider = totalCountOfOfferSoldForfProviderArray.reduce(function(a, b){return a + b;}, 0);
    let totalPaidToProvider = totalPaidToProviderArray.reduce(function(a, b){return a + b;}, 0);
    console.log("Total earning  the provider has done for all orders" , totalEarningOfProvider)
    console.log("Total product offerings the Provider has sold" , totalCountOfOfferSoldForfProvider );

    return createResponse(200, {"message": "Provider Orders List",
        "providerOrderLists": providerOrderLists ,
        "totalEarningOfProvider" : totalEarningOfProvider,
        "totalCountOfProductOfferingSoldByfProvider" : totalCountOfOfferSoldForfProvider,
        "totalPaidToProvider"  :  totalPaidToProvider,
        "totalProviderOrdersCount"  :  providerOrderLists.Count
    });

}



module.exports.getAllChefsEarningDetails = async (event,context) =>{
    try {
    let {appId}  =  event.queryStringParameters || {};   
    appId =  appId ? appId : 'food'; 
    //console.log("event is ",event);
    let getAllChefsIdsArray = [];
    let getAllChefOrderDetails = [];
    let userType = "provider_consumer";
    let getAllChefs = await dynamoOperations.findUsersByType(userType , appId);
    //console.log("getAllChefs",getAllChefs);
    
    for(let singleChef of getAllChefs.Items){
        //console.log("single cheg" , singleChef);
        getAllChefsIdsArray.push(singleChef.userId);
    }
    
    //getAllChefsIdsArray = getAllChefsIdsArray.slice(5,15);
    for(let chefId of getAllChefsIdsArray){
        providerOrderLists = await dynamoOperations.getProviderOrdersList(chefId); //Fetch data from ProviderOrders Table 
        //console.log("providerOrderList2", providerOrderLists);
        if(providerOrderLists && providerOrderLists.Count > 0){
        let newEvent = {
            "pathParameters" : {
            "providerId" :  chefId
            }
        }  
        let result   = await getProviderOrderList(newEvent);  // This will fetch all order details for the chef  
        //console.log("result is ",result);
        let chefAllOrderDetails = JSON.parse(result.body);
        //console.log("chefAllOrderDetails", chefAllOrderDetails);
        console.log("chefAllOrderDetails earning" , chefAllOrderDetails.totalEarningOfProvider);
        let chefInfo =  await dynamoOperations.findUserById(chefId);
        let newEvent1 = JSON.stringify(
            {
                "startDate" : "2020-07-28", 
                "endDate"  :  new Date().toJSON(), 
                "userId" : chefId
            }
        )
        newEvent1 = {
            body : newEvent1
        }
        let getUserReferralEarning = await referralEarnings.getUserEarningsByDateAndUser(newEvent1);
        //console.log("getUserReferralEarning" , getUserReferralEarning);
        getUserReferralEarning = JSON.parse(getUserReferralEarning.body);
        //console.log("getUserReferralEarning"  ,getUserReferralEarning.earnings);
        chefAllOrderDetails = Object.assign( chefInfo.Items[0] , {"totalEarningsOfProvider" : chefAllOrderDetails.totalEarningOfProvider});
        chefAllOrderDetails = Object.assign(chefAllOrderDetails , getUserReferralEarning.earnings);
        //console.log("chefAllOrderDetails" , chefAllOrderDetails);
        getAllChefOrderDetails.push(chefAllOrderDetails);
        }
        
    }
    //console.log("getAllChefOrderDetailssss", getAllChefOrderDetails);
    return createResponse(200, {"getAllChefOrderDetails": getAllChefOrderDetails});;
}catch(error){
    console.log("eror ir ",error);
}
}