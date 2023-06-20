"use strict";

var emailHelpers = require("*/cartridge/scripts/helpers/emailHelpers");
var Site = require("dw/system/Site");
var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var OrderMgr = require("dw/order/OrderMgr");
var locale = request.getLocale();

/**
 * Updates the email context with user and email related data for sending email
 * @param {string} customerNo - The customer number to identify the customer
 * @param {dw.order.Order} order - The order object 
 * @param {Object} context - The email context object to be updated
 * @param {string} actionUrl - The action URL for the email
 * @param {Object} emailObj - The email object containing from, to and subject fields
 * @param {string} subject - The subject of the email
 */
function updateEmailContextWithUserData(
  customerNo,
  order,
  context,
  actionUrl,
  emailObj,
  subject
) {
  var CustomerMgr = require("dw/customer/CustomerMgr");
  var userObj = {};
  var customerProfile = CustomerMgr.getProfile(customerNo);
  // If the customer profile is found, add the customer's first name and last name to the user object.
  if (customerProfile) {
    userObj.firstName = customerProfile.firstName;
    userObj.lastName = customerProfile.lastName;
  }
  // Otherwise, add the customer name from the order object to the user object.
  else {
    userObj.firstName = order.customerName;
  }
  context.customer = userObj;
  context.url = actionUrl;

  // Update an email object with new values for the "from", "to", and "subject" fields.
  emailObj.from =
    Site.current.getCustomPreferenceValue("customerServiceEmail") ||
    "no-reply@salesforce.com";
  emailObj.to = order.customerEmail;
  emailObj.subject = subject;
}

/**
 * Retrieves the name of a product with a given product ID.
 * @param {string} productID - The ID of the product to retrieve the name for.
 * @returns {string|null} - The name of the product, or null if the product with the given ID does not exist.
 */
function getProductName(productID) {
  var ProductMgr = require("dw/catalog/ProductMgr");
  var product = ProductMgr.getProduct(productID);
  if (product) {
    return product.name;
  }
  return null;
}

/**
 * Notifies the customer about the order confirmation via email.
 * @param {dw.order.Order} order - The order object.
 * @param {string} customerNo - The customer number.
 */
function notifyOrderConfirmation(order, customerNo, isSubscribedFlag) {
  var subscriptionHelpers = require("~/cartridge/scripts/subscription/subscriptionHelpers");
  var OrderModel = require("*/cartridge/models/order");
  var context = {};
  var emailObj = {};
  var orderModel = new OrderModel(order, {
    countryCode: locale.country,
    containerView: "order",
  });

  var subscriptionOrder = false;

  // Finding whether it is a subscription product
  var iter = order.productLineItems.iterator();    
  var pli;
  while(iter.hasNext()) {
      pli = iter.next();
      if(pli.custom && pli.custom.subscriptionItem) {
          subscriptionOrder = true;
          break;
      }
  }


  if(!subscriptionOrder || isSubscribedFlag) {
    var subscribedProductDetails =
    subscriptionHelpers.getSubscriptionDetailsForOrder(order, customerNo);
    updateEmailContextWithUserData(
      customerNo,
      order,
      context,
      URLUtils.https("Account-Show"),
      emailObj,
      Resource.msg("subject.order.confirmation.email", "order", null)
    );
    emailObj.type = emailHelpers.emailTypes.orderConfirmation;

    context.order = orderModel;
    context.hasSubscriptionProductInOrder = false;

    if (Object.keys(subscribedProductDetails).length != 0) {
      context.hasSubscriptionProductInOrder = true;
      context.subscribedProductDetails = subscribedProductDetails;
    }

    emailHelpers.sendEmail(
      emailObj,
      "mail/subscriptionOrderConfirmation",
      context
    );
  }
}

/**
 * Notifies the customer about the expiration of their subscription credit card.
 * @param {string} customerNo - The customer number.
 * @param {dw.order.Order} originalOrder - Current user's initial order.
 */
function notifyCreditCardExpiration(customerNo, originalOrder) {
  var context = {};
  var emailObj = {};

  updateEmailContextWithUserData(
    customerNo,
    originalOrder,
    context,
    URLUtils.https("PaymentInstruments-AddPayment"),
    emailObj,
    Resource.msg("email.subject.creditcard.expired", "subscription", null)
  );
  emailHelpers.sendEmail(
    emailObj,
    "mail/creditCardExpiryNotification",
    context
  );
}

/**
 * Notifies the cancellation of a subscription product to the customer via email.
 * @param {Object} subscriptionProduct - The subscription product object.
 */
function notifySubscriptionCancellation(subscriptionProduct) {
  var OrderModel = require("*/cartridge/models/order");
  var originalOrder = OrderMgr.getOrder(
    subscriptionProduct.custom.originalOrderNo
  );
  var orderModel = new OrderModel(originalOrder, {
    countryCode: locale.country,
    containerView: "order",
  });
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    subscriptionProduct.custom.customerNo,
    originalOrder,
    context,
    URLUtils.https("Account-Show"),
    emailObj,
    Resource.msg("email.subject.subscription.cancel", "subscription", null)
  );
  context.productID = subscriptionProduct.custom.productId;
  context.order = orderModel;
  context.quantity = subscriptionProduct.custom.quantity;

  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionCancelNotification",
    context
  );
}

/**
 * Notifies customers about subscription product updates through email.
 * @param {Object} subscriptionProduct - The subscription product to send updates for.
 */
function notifySubscriptionUpdatation(subscriptionProduct) {
  var OrderModel = require("*/cartridge/models/order");
  var originalOrder = OrderMgr.getOrder(
    subscriptionProduct.custom.originalOrderNo
  );
  var orderModel = new OrderModel(originalOrder, {
    countryCode: locale.country,
    containerView: "order",
  });
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    subscriptionProduct.custom.customerNo,
    originalOrder,
    context,
    URLUtils.https("Account-Show"),
    emailObj,
    Resource.msg("email.subject.subscription.update", "subscription", null)
  );
  context.productID = subscriptionProduct.custom.productId;
  context.order = orderModel;
  context.quantity = subscriptionProduct.custom.quantity;
  context.orderInterval = subscriptionProduct.custom.orderInterval;
  context.nextOrderDate = subscriptionProduct.custom.nextOrderDate;

  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionUpdateNotification",
    context
  );
}

/**
 * Sends a subscription reactivation notification email to the customer.
 * @param {Object} subscriptionProduct - The subscription product object.
 */
function notifySubscriptionReactivation(subscriptionProduct) {
  var OrderModel = require("*/cartridge/models/order");
  var originalOrder = OrderMgr.getOrder(
    subscriptionProduct.custom.originalOrderNo
  );
  var orderModel = new OrderModel(originalOrder, {
    countryCode: locale.country,
    containerView: "order",
  });
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    subscriptionProduct.custom.customerNo,
    originalOrder,
    context,
    URLUtils.https("Account-Show"),
    emailObj,
    Resource.msg("email.subject.subscription.reactivate", "subscription", null)
  );
  var productID = subscriptionProduct.custom.productId;
  var productName = getProductName(productID);
  context.productID = productID;
  context.order = orderModel;
  context.quantity = subscriptionProduct.custom.quantity;
  context.orderInterval = subscriptionProduct.custom.orderInterval;
  context.productName = productName ? productName : null;
  context.nextOrderDate = subscriptionProduct.custom.nextOrderDate;

  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionReactivateNotification",
    context
  );
}

/**
 * Notifies the customer about a failed subscription payment via email.
 * @param {dw.order.Order} order - The order object associated with the failed subscription payment.
 * @param {string} customerNo - The customer number associated with the failed subscription payment.
 * @param {string} paymentMethod - The payment method used for the failed subscription payment.
 */
function notifySubscriptionPaymentFailure(order, customerNo, paymentMethod) {
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    customerNo,
    order,
    context,
    URLUtils.https("Account-Show"),
    emailObj,
    Resource.msg(
      "email.subject.subscription.payment.failure",
      "subscription",
      null
    )
  );
  context.order = order;
  context.paymentMethod = paymentMethod;

  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionPaymentFailureNotification",
    context
  );
}

function notifySubscriptionDiscontinued(subscriptionProduct){
  var originalOrder = OrderMgr.getOrder(
    subscriptionProduct.custom.originalOrderNo
  );
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    subscriptionProduct.custom.customerNo,
    originalOrder,
    context,
    "",
    emailObj,
    Resource.msg("email.subscription.discontinued.subject", "subscription", null)
  );
  context.companyName = Site.current.getCustomPreferenceValue("companyName");
  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionDiscontinuedNotification",
    context
  );
  

}

function sendSubscriptionDiscontinuedNotification(subscriptionProduct) {
  var Site = require("dw/system/Site");  
  var originalOrder = OrderMgr.getOrder(
    subscriptionProduct.custom.originalOrderNo
  );
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    subscriptionProduct.custom.customerNo,
    originalOrder,
    context,
    "",
    emailObj,
    Resource.msg(
      "email.subscription.discontinued.subject",
      "subscription",
      null
    )
  );
  context.companyName = Site.current.getCustomPreferenceValue("companyName");
  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionDiscontinuedNotification",
    context
  );
}

function sendSubscriptionDelayNotification(subscriptionProduct) {
  var Site = require("dw/system/Site");  
  var originalOrder = OrderMgr.getOrder(
    subscriptionProduct.custom.originalOrderNo
  );
  var context = {};
  var emailObj = {};
  updateEmailContextWithUserData(
    subscriptionProduct.custom.customerNo,
    originalOrder,
    context,
    "",
    emailObj,
    Resource.msg("email.subscription.delayed.subject", "subscription", null)
  );
  context.companyName = Site.current.getCustomPreferenceValue("companyName");
  emailHelpers.sendEmail(
    emailObj,
    "mail/subscriptionDelayNotification",
    context
  );
}
module.exports = {
  notifyOrderConfirmation: notifyOrderConfirmation,
  notifyCreditCardExpiration: notifyCreditCardExpiration,
  notifySubscriptionCancellation: notifySubscriptionCancellation,
  notifySubscriptionReactivation: notifySubscriptionReactivation,
  notifySubscriptionUpdatation: notifySubscriptionUpdatation,
  notifySubscriptionPaymentFailure: notifySubscriptionPaymentFailure,
  sendSubscriptionDiscontinuedNotification:sendSubscriptionDiscontinuedNotification,
  sendSubscriptionDelayNotification:sendSubscriptionDelayNotification,
};
