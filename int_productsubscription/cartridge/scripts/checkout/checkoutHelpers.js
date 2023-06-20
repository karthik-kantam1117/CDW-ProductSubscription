"use strict";
var base = module.superModule;
var SUBSCRIPTION_STATUS_NOT_APPLICABLE = 0;
var SUBSCRIPTION_STATUS_PENDING = 1;
var SUBSCRIPTION_STATUS_COMPLETE = 2;
var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
function placeOrder(order, fraudDetectionStatus, delayedSubscriptionOrderFlag) {
  var result = { error: false };
  var Transaction = require('dw/system/Transaction');
  var OrderMgr = require('dw/order/OrderMgr');
  var Order = require('dw/order/Order');
  var GiftCertificateMgr = require('dw/order/GiftCertificateMgr');
  var Status = require('dw/system/Status');
  var hasCurrentItem = false;

  // for non-delayed orders
  // Finding whether it has a normal(non-subscription) product
  if(!delayedSubscriptionOrderFlag) {
    var iter = order.productLineItems.iterator();    
    var pli;
    while(iter.hasNext()) {
      pli = iter.next();
      if(pli.custom && pli.custom.subscriptionItem && (subscriptionHelpers.dateToStrFunc(pli.custom.selectedOrderDate) === subscriptionHelpers.dateToStrFunc(new Date()))) {
          hasCurrentItem = true;
          break;
      } else if(!(pli.custom && pli.custom.subscriptionItem)) {
          hasCurrentItem = true;
          break;
      }
    }
  }

  try {
      Transaction.begin();
      // Placing order for normal products
      if(hasCurrentItem || delayedSubscriptionOrderFlag) {
        var placeOrderStatus = OrderMgr.placeOrder(order);
        if (placeOrderStatus === Status.ERROR) {
            throw new Error();
        }
      }

      if (fraudDetectionStatus.status === 'flag') {
          order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
      } else {
          order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
      }

      // Checks and creates the Gift Certificate
      if (order.giftCertificateLineItems.getLength() > 0) {
          var giftCert = order.giftCertificateLineItems[0];
          var giftCertAmount = new Number(giftCert.priceValue);
          var createdGiftCertificate = GiftCertificateMgr.createGiftCertificate(giftCertAmount);

          //createdGiftCertificate.setOrderNo(order.OrderNo);
          createdGiftCertificate.setRecipientEmail(giftCert.recipientEmail);
          createdGiftCertificate.setRecipientName(giftCert.recipientName);
          createdGiftCertificate.setSenderName(order.customerName);
          createdGiftCertificate.setMessage(giftCert.message);

          // Pass the gift cert code to result object
          result.giftCertCode = createdGiftCertificate.giftCertificateCode;
      }

      order.setExportStatus(Order.EXPORT_STATUS_READY);
      Transaction.commit();
  } catch (e) {
      Transaction.wrap(function () { OrderMgr.failOrder(order); });
      result.error = true;
  }

  return result;
}

/**
 * Sends a confirmation to the current user
 * @param {dw.order.Order} order - The current user's order
 * @param {string} locale - the current request's locale id
 * @returns {void}
 */
function sendConfirmationEmail(order, locale, isSubscribedFlag) {
  var OrderModel = require("*/cartridge/models/order");
  var emailHelpers = require("*/cartridge/scripts/email/emailHelpers");
  var Locale = require("dw/util/Locale");
  var currentLocale = Locale.getLocale(locale);
  emailHelpers.notifyOrderConfirmation(order, order.customerNo, isSubscribedFlag);
}

function saveSubscription(customer, order) {
  var CustomObjectMgr = require("dw/object/CustomObjectMgr");
  var collections = require("*/cartridge/scripts/util/collections");
  var Transaction = require("dw/system/Transaction");
  var UUIDUtils = require("dw/util/UUIDUtils");
  var SubscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");

  if (order && order.allProductLineItems && customer && customer.ID) {
    var allLineItems = order.allProductLineItems;
    collections.forEach(allLineItems, function (pli) {
      if (pli && pli.custom && pli.custom.subscriptionItem) {
        Transaction.wrap(function () {
          // If the customer don't have profile(i.e. guest user) then we will use customer ID as customerNo
          var customerNo = customer.getProfile()
            ? customer.getProfile().getCustomerNo()
            : customer.getID();
          var productID = pli.productID;
          var subscriptionObject;

          subscriptionObject = CustomObjectMgr.createCustomObject(
            "ProductSubscriptions",
            UUIDUtils.createUUID()
          );

          subscriptionObject.custom.customerNo = customerNo;
          subscriptionObject.custom.originalOrderNo = order.orderNo;
          subscriptionObject.custom.productId = productID;
          subscriptionObject.custom.quantity = pli.quantityValue;
          subscriptionObject.custom.orderInterval =
            pli.custom.subscriptionInterval;
          subscriptionObject.custom.isActive = true;

          // PDP selected/delayed order date
          var selectedOrderDate = pli.custom.selectedOrderDate;
          subscriptionObject.custom.selectedOrderDate = selectedOrderDate;
          var nextNextOrderDate =
            SubscriptionHelpers.getNextPreferredOrderDate(
              pli.custom.subscriptionInterval,
              subscriptionObject.custom.selectedOrderDate.getDate(),
              selectedOrderDate
            );
            if(SubscriptionHelpers.dateToStrFunc(pli.custom.selectedOrderDate) === SubscriptionHelpers.dateToStrFunc(new Date())) {
              subscriptionObject.custom.nextOrderDate = nextNextOrderDate;
              subscriptionObject.custom.nextNextOrderDate = 
                SubscriptionHelpers.getNextPreferredOrderDate(
                  pli.custom.subscriptionInterval,
                  subscriptionObject.custom.selectedOrderDate.getDate(),
                  nextNextOrderDate
                );
            } else {
              subscriptionObject.custom.nextOrderDate = selectedOrderDate;
              subscriptionObject.custom.nextNextOrderDate = nextNextOrderDate;
            }
            pli.custom.subscriptionID = subscriptionObject.custom.ID;
        });
      }
    });
  }
}

module.exports = {
  sendConfirmationEmail: sendConfirmationEmail,
  saveSubscription: saveSubscription,
  placeOrder: placeOrder
};

Object.keys(base).forEach(function (prop) {
  if (!module.exports.hasOwnProperty(prop)) {
    module.exports[prop] = base[prop];
  }
});
