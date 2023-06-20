/**
 * Recurring order
 */

"use strict";

var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var Logger = require("dw/system/Logger");
var ProductMgr = require("dw/catalog/ProductMgr");
const SUBSCRIPTION_OBJECT_NAME = "ProductSubscriptions";

/**
 * Recurring Order
 * This script should be executed as part of Job Schedule and will create a subscription order on behalf of the customer.
 */
function process() {
  var subscriptionOrderHelpers = require("~/cartridge/scripts/order/subscriptionOrderHelpers");
  var emailHelpers = require("~/cartridge/scripts/email/emailHelpers");
  var subscriptionHelpers = require("~/cartridge/scripts/subscription/subscriptionHelpers");

  // Query to retrieve product subscriptions with a next order date less than or equal to the current date and are active.
  var query = "custom.nextOrderDate<={0} AND custom.isActive={1}";

  // Set the current date to the end of the day
  var currentDate = new Date();
  currentDate.setHours(23, 59, 59, 999);

  // Retrieve a list of product subscriptions that match the query
  var productSubscriptions = CustomObjectMgr.queryCustomObjects(
    "ProductSubscriptions",
    query,
    null,
    currentDate,
    true
  ).asList();
  if (productSubscriptions && productSubscriptions.length > 0) {
    for (var i = 0; i < productSubscriptions.length; i++) {
      var subscriptionProduct = productSubscriptions[i];
      if (subscriptionProduct && subscriptionProduct.custom) {
        var subscriptionProductInfo = subscriptionProduct.custom;
        var product = ProductMgr.getProduct(subscriptionProductInfo.productId);
        // Check if the product is orderable with the given quantity
        if (
          subscriptionHelpers.checkSubscriptionProductAvailability(
            subscriptionProduct
          )
        ) {
          // Create a subscription order for the subscription product
          subscriptionOrderHelpers.createSubscriptionOrder(
            subscriptionProductInfo
          );
        }
      }
    }
  } else {
    // Log a message if there are no subscription orders found for the current date
    Logger.info("No subscription orders found for " + currentDate);
  }
}

exports.process = process;
