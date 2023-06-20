'use strict'

var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');
var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");

const STRING_COMMA_SEPARATOR = ',';
const SUBSCRIPTION_PRICE_BOOK_NAME = Site.current.getCustomPreferenceValue('subscriptionPriceBookName');

function getSubscriptionAllowedInterval(apiProduct){
    var subscriptionAllowedInterval = [];
    if(!empty(apiProduct.custom.subscriptionAllowedInterval)){
        subscriptionAllowedInterval = apiProduct.custom.subscriptionAllowedInterval.split(STRING_COMMA_SEPARATOR);
    }
    return subscriptionAllowedInterval;
}

function getSubscriptionPrice(apiProduct){
    var subscriptionPrice;
    var priceModel = apiProduct.getPriceModel();
    if(priceModel){
        subscriptionPrice = priceModel.getPriceBookPrice(SUBSCRIPTION_PRICE_BOOK_NAME);
    }
    return subscriptionPrice;
}



module.exports = function (object, apiProduct) {
    Object.defineProperty(object, 'subscriptionEnabled', {
        enumerable: true,
        value: apiProduct.custom.subscriptionEnabled
    });

    Object.defineProperty(object, 'subscriptionType', {
        enumerable: true,
        value: apiProduct.custom.subscriptionType
    });

    Object.defineProperty(object, 'subscriptionSaveValue', {
        enumerable: true,
        value: subscriptionHelpers.getSubscriptionSaveValue(apiProduct)
    });

    Object.defineProperty(object, 'subscriptionAllowedInterval', {
        enumerable: true,
        value: getSubscriptionAllowedInterval(apiProduct)
    });

    Object.defineProperty(object, 'subscriptionPrice', {
        enumerable: true,
        value: getSubscriptionPrice(apiProduct)
    });

    Object.defineProperty(object, 'subscriptionMessage', {
        enumerable: true,
        value: subscriptionHelpers.getSubscriptionMessage(apiProduct)
    });

}