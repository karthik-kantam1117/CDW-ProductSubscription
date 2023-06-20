/**
 * Credit Card Expiry Notification
 */

"use strict";

const SUBSCRIPTION_OBJECT_NAME = "ProductSubscriptions";
const DAYS_BEFORE_EXPIRATION_TO_CHECK = 14;
var CustomerMgr = require("dw/customer/CustomerMgr");
var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var Logger = require("dw/system/Logger");
var ProductMgr = require("dw/catalog/ProductMgr");
var OrderMgr = require("dw/order/OrderMgr");

/**
 * Credit Card Expiry Notification
 * 
 * Credit Card Expiry Notification job script that sends a credit card expiry notification to customers
 * whose credit card will expire before the next order date.
 */
function process() {
  var subscriptionHelpers = require("~/cartridge/scripts/subscription/subscriptionHelpers");
  var emailHelpers = require("~/cartridge/scripts/email/emailHelpers");
  var query =
    "custom.nextOrderDate>={0} AND custom.nextOrderDate<={1} AND custom.isActive={2}";
  // Calculate the start and end dates of the notification interval
  var intervalStartDate = new Date();
  intervalStartDate.setHours(0, 0, 0, 0); // Set to the beginning of the day
  var intervalEndDate = new Date();
  intervalEndDate.setHours(23, 59, 59, 999); // Set to the end of the day
  intervalEndDate.setDate(
    intervalStartDate.getDate() + DAYS_BEFORE_EXPIRATION_TO_CHECK
  );

  var productSubscriptions = CustomObjectMgr.queryCustomObjects(
    SUBSCRIPTION_OBJECT_NAME,
    query,
    null,
    intervalStartDate,
    intervalEndDate,
    true
  ).asList();

  // Send a credit card expiry notification to each customer whose credit card will expire before the next order date
  if (productSubscriptions && productSubscriptions.length > 0) {
    for (var i = 0; i < productSubscriptions.length; i++) {
      var subscriptionProduct = productSubscriptions[i];
      if (subscriptionProduct && subscriptionProduct.custom) {
        var subscriptionProductInfo = subscriptionProduct.custom;
        var customerNo = subscriptionProductInfo.customerNo;
        var originalOrder = OrderMgr.getOrder(subscriptionProductInfo.originalOrderNo);
        
        if (
          !subscriptionHelpers.isValidCreditCardAvailable(
            customerNo,
            originalOrder
          )
        ) {
          emailHelpers.notifyCreditCardExpiration(
            customerNo,
            originalOrder
          );
        }
      }
    }
  }
}

exports.process = process;
