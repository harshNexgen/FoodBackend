const { v4: uuidv4 } = require('uuid');
const dynamoOperations = require('../common/dynamo');
const { createResponse } = require('../common/helper')

module.exports.getUserEarnings = async (event, context) => {
    console.log("inside getUserEarnings ");
    let reqBody = JSON.parse(event.body);
    let { userId } = event.pathParameters;
    if (!userId) {
        return createResponse(400, { "message": "userId or providerId  Missing" });
    }
    try {
        let earnings = await dynamoOperations.getReferralEarningsByUser(userId);
        console.log("get user referral earnings:", earnings);

        return createResponse(200, {"message": "get earnings successful", orders: earnings.Items});
    }catch(e){
        return createResponse(500, { "message": e, error:true });
    }
}


module.exports.getUserEarningsByDateAndUser = async (event, context) => {
    //console.log("inside getUserEarnings ");
    let reqBody = JSON.parse(event.body);
    console.log("reqBody",reqBody)
    const {startDate, endDate, userId} = reqBody
    if (!userId) {
        return createResponse(400, { "message": "userId or providerId  Missing" });
    }
    try {
        let earnings = await dynamoOperations.getReferralEarningsByDate(startDate, endDate, userId , 'picked');
        let allReferrals = await dynamoOperations.findUsersByReferredById(userId);
        console.log("get user referral earnings:", earnings);
        let earningsResponse = {}
        let makeEarningsResponse = {}
        let totalReferralEarning = 0
        let totalReferralPaid = 0
        let totalReferralEarningTillDate = 0
        earningsResponse['referredUsers'] = []
        let index = 0
        if(earnings && earnings.Count>0) {
            earnings.Items.forEach((Item) => {
                if(Item.orderStatus!='created' && Item.orderStatus!='failed' && Item.orderStatus!='captured') {
                    console.log("makeEarningsResponse", makeEarningsResponse[Item.commissionForUserId])
                    totalReferralEarning = +totalReferralEarning + +parseFloat(Item.commission)
                    if (makeEarningsResponse[Item.commissionForUserId] != undefined) {
                        let i = makeEarningsResponse[Item.commissionForUserId]
                        console.log('i', i)
                        console.log(earningsResponse['referredUsers'][i])
                        earningsResponse['referredUsers'][i].totalReferralAmount = (+earningsResponse['referredUsers'][i].totalReferralAmount + +Item.commission).toFixed(2)
                    } else {
                        console.log("else", Item)
                        makeEarningsResponse[Item.commissionForUserId] = index
                        earningsResponse['referredUsers'][index] = {
                            userName: Item.commissionForUserName,
                            userType: Item.commissionForUserType,
                            userId: Item.commissionForUserId,
                            totalReferralAmount: Item.commission,
                        }
                        index++
                    }
                }
            })
        }
        earningsResponse['totalReferralEarning'] = totalReferralEarning.toFixed(2)
        earningsResponse['totalReferralPaid'] = totalReferralPaid.toFixed(2)
        earningsResponse['totalReferralEarningTillDate'] = totalReferralEarningTillDate.toFixed(2)
        earningsResponse['allReferrals'] = allReferrals.Items

        return createResponse(200, {"message": "get earnings successful", earnings: earningsResponse});
    }catch(e){
        return createResponse(500, { "message": e, error:true });
    }
}