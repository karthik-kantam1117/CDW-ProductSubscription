'use strict';

/**
 * @namespace Account
 */

var server = require('server');
server.extend(module.superModule);
var CustomerMgr = require("dw/customer/CustomerMgr");
const SUBSCRIPTION_OBJECT_NAME = "ProductSubscriptions";

/**
 * Account-Show : The Account-Show endpoint will render the shopper's account page. Once a shopper logs in they will see is a dashboard that displays profile, address, payment and order information.
 * @name Base/Account-Show
 * @function
 * @memberof Account
 * @param {querystringparameter} - registration - A flag determining whether or not this is a newly registered account
 * @param {category} - senstive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.append('Show', function(req, res, next) {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr'); 
    var ProductMgr = require('dw/catalog/ProductMgr'); 
    var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
    var result = res.getViewData();

    var customer = CustomerMgr.getCustomerByCustomerNumber(
      req.currentCustomer.profile.customerNo
    );
    var profile = customer.getProfile();
    var paymentInstrument;
    var uuid = profile.custom?profile.custom.defaultCreditCardUUID:undefined;
    var paymentInstruments = profile.wallet?profile.wallet.paymentInstruments:undefined;

    if(paymentInstruments) {
      paymentInstrument = profile.wallet.paymentInstruments.toArray().find((paymentInstrument)=>paymentInstrument.UUID === uuid);
    } 

    result.payment = paymentInstrument?paymentInstrument:(paymentInstruments && paymentInstruments.length?paymentInstruments[0]:undefined);
    var query = "custom.customerNo={0} AND custom.isActive={1}"; 
    var upcomingSubscription = CustomObjectMgr.queryCustomObjects(SUBSCRIPTION_OBJECT_NAME, query, "custom.nextOrderDate asc", profile.customerNo, true).first();
    if (upcomingSubscription) { 
      var apiProduct = ProductMgr.getProduct(upcomingSubscription.custom.productId); 
      var nextOrderDate = subscriptionHelpers.shortDateToStrFunc(upcomingSubscription.custom.nextOrderDate); 
      var orderTotal = subscriptionHelpers.getSubscriptionPrice(apiProduct) * upcomingSubscription.custom.quantity; 
      var product = ProductMgr.getProduct(upcomingSubscription.custom.productId);
      var productImage = apiProduct.getImage('small', 0).getURL();
      var productName = apiProduct.name;
      result.upcomingSubscription = { 
        nextOrderDate: nextOrderDate, 
        orderTotal: orderTotal, 
        quantity: upcomingSubscription.custom.quantity,
        productImage: productImage,
        productName: productName
      }; 
    }
    res.setViewData(result);
    next();
});


module.exports = server.exports();