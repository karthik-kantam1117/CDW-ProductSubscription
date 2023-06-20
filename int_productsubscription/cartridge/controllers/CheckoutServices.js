"use strict";

/**
 * @namespace CheckoutServices
 */

var server = require("server");
server.extend(module.superModule);
const SUBSCRIPTION_STATUS_NOT_APPLICABLE = 0;
const SUBSCRIPTION_STATUS_PENDING = 1;
const SUBSCRIPTION_STATUS_COMPLETE = 2;
var Transaction = require("dw/system/Transaction");
var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");

/**
 * CheckoutServices-PlaceOrder : The CheckoutServices-PlaceOrder endpoint places the order
 * @name Base/CheckoutServices-PlaceOrder
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.append("PlaceOrder", function (req, res, next) {
  var Transaction = require("dw/system/Transaction");
  var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");
  var OrderMgr = require("dw/order/OrderMgr");
  var orderID = res.getViewData().orderID;
  var order = OrderMgr.getOrder(orderID);
  var customer = order.getCustomer();

  COHelpers.saveSubscription(customer, order);

  var iter = order.productLineItems.iterator();
  var pli;
  var subscriptionOrderFlag = false;
  while (iter.hasNext()) {
    pli = iter.next();
    if (
      pli.custom &&
      pli.custom.subscriptionItem &&
      subscriptionHelpers.dateToStrFunc(pli.custom.selectedOrderDate) ===
        subscriptionHelpers.dateToStrFunc(new Date())
    ) {
      Transaction.wrap(function () {
        pli.custom.subscriptionStatus = SUBSCRIPTION_STATUS_COMPLETE;
      });
      subscriptionOrderFlag = true;
    } else if (pli.custom && pli.custom.subscriptionItem) {
      Transaction.wrap(function () {
        pli.custom.subscriptionStatus = SUBSCRIPTION_STATUS_PENDING;
      });
      subscriptionOrderFlag = true;
    } else {
      Transaction.wrap(function () {
        pli.custom.subscriptionStatus = SUBSCRIPTION_STATUS_NOT_APPLICABLE;
      });
    }
  }

  if (order.getCustomerEmail() && subscriptionOrderFlag) {
    COHelpers.sendConfirmationEmail(order, req.locale.id, true);
  }
  Transaction.wrap(function () {
    if (order.custom) {
      order.custom.isSubscriptionOrder = true;
    }
  });
  next();
});

module.exports = server.exports();
