"use strict";
const subscriptionObjectType = "ProductSubscriptions";
var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var OrderMgr = require("dw/order/OrderMgr");
var collections = require("*/cartridge/scripts/util/collections");
var ArrayList = require("dw/util/ArrayList");
var URLUtils = require("dw/web/URLUtils");
var Transaction = require("dw/system/Transaction");
var Site = require("dw/system/Site");
var ProductMgr = require("dw/catalog/ProductMgr");
var Resource = require("dw/web/Resource");
var Logger = require("dw/system/Logger");

const SUBSCRIPTION_TYPE_PERCENT_OFF = 'PERCENT_OFF';
const SUBSCRIPTION_TYPE_AMOUNT_OFF = 'AMOUNT_OFF';
const HUNDRED = 100;
const SUBSCRIPTION_PRICE_BOOK_NAME = Site.current.getCustomPreferenceValue(
  "subscriptionPriceBookName"
);
var CustomerMgr = require("dw/customer/CustomerMgr");
var emailHelpers = require("~/cartridge/scripts/email/emailHelpers");

/**
 * Funtion to get subscribed product lineitems from original order
 * @param {dw.order.Order} order - Current user's initial order
 * @returns - all subscribed productline items from the original order
 */
function getSubscribedProductLineItems(order) {
  var allProductLineItems = order.getAllProductLineItems();
  var subscribedProductLineItems = new ArrayList();
  collections.forEach(allProductLineItems, function (pli) {
    if (pli && pli.custom && pli.custom.subscriptionItem) {
      subscribedProductLineItems.add(pli);
    }
  });

  return subscribedProductLineItems;
}

/**

Retrieves the subscription product for a given customer and product ID.
@param {string} customerNo - The customer number.
@param {string} productID - The ID of the product.
@returns {Object} - The subscription product for the given customer and product ID.
*/
function getSubscriptionProduct(subscriptionID) {
  var query = "custom.ID={0}";
  var subscriptionProduct = CustomObjectMgr.queryCustomObject(
    subscriptionObjectType,
    query,
    subscriptionID
  );

  return subscriptionProduct;
}

/**
 * @description returns subscription object or null
 * @param {string} subscriptionId - subscription identifier
 * @returns {Object}
 */
function getProductSubscriptionBySubscriptionID(subscriptionID) {
  var query = "custom.ID = {0}";
  try {
    var subscription = CustomObjectMgr.queryCustomObject(
      subscriptionObjectType,
      query,
      subscriptionID
    );
    return subscription;
  } catch (e) {
    Logger.error("Error in fetching a subscription. Cause - {0}", e.message);
    return null;
  }
}

function updateAllSubscribedProductLineItems(
  allSubscribedProductLineItems,
  subscribedProductLineItems
) {
  collections.forEach(subscribedProductLineItems, function (pli) {
    allSubscribedProductLineItems.add(pli);
  });
}

/**
 * @description Get subscriptions of any type
 * @param customer
 * @param subscriptionType
 * @returns
 */
function getSubscriptions(customer, subscriptionType) {
  var customerNo = customer.profile.customerNo;
  var query = "custom.customerNo={0} AND custom.isActive={1}";
  var sortString = "custom.nextOrderDate asc";

  var subscriptions = CustomObjectMgr.queryCustomObjects(
    subscriptionObjectType,
    query,
    sortString,
    customerNo,
    subscriptionType === "cancel" ? false : true
  ).asList();

  var allSubscribedProductLineItems = new ArrayList();

  collections.forEach(subscriptions, function (activeSubscription) {
    var subscription = activeSubscription.custom;
    var originalOrder = OrderMgr.getOrder(subscription.originalOrderNo);
    var subscribedProductLineItems =
      getSubscribedProductLineItems(originalOrder);
    updateAllSubscribedProductLineItems(
      allSubscribedProductLineItems,
      subscribedProductLineItems
    );
  });

  return allSubscribedProductLineItems;
}

/**
 * Generates an object of URLs
 * @returns {Object} an object of URLs in string format
 */
function getSubscriptionActionUrls() {
  return {
    cancelSubscriptionUrl: URLUtils.url(
      "Subscription-CancelSubscription"
    ).toString(),
    mySubscriptionsUrl: URLUtils.url("Subscription-Show").toString(),
    updateSubscriptionDetails: URLUtils.url(
      "Subscription-UpdateDetails"
    ).toString(),
    updateQuantityUrl: URLUtils.url("Subscription-UpdateQuantity").toString(),
    reactivateSubscriptionUrl: URLUtils.url(
      "Subscription-ReactivateSubscription"
    ).toString(),
    getSubscriptionsUrl: URLUtils.url(
      "Subscription-TabSubscriptions"
    ).toString(),
    getUpcomingDeliveriesUrl: URLUtils.url(
      "Subscription-UpcomingDeliveries"
    ).toString(),
    saveNextOrderDateUrl: URLUtils.url(
      "Subscription-SavePreferredOrderDate"
    ).toString(),
    quickOrderUrl: URLUtils.url("Subscription-QuickOrder").toString(),
  };
}
/**
 * Checks if a customer has already subscribed to a particular product.
 * @param {string} customerNo - The unique identifier of the customer.
 * @param {string} productID - The unique identifier of the product.
 * @returns {boolean} - Returns true if the customer is subscribed to the product, otherwise returns false
 */
function isAlreadySubscribed(customerNo, productID) {
  var query = "custom.customerNo={0} AND custom.productId={1}";
  var sortString = "custom.nextOrderDate";
  var subscriptionProduct = CustomObjectMgr.queryCustomObject(
    subscriptionObjectType,
    query,
    customerNo,
    productID
  );
  return subscriptionProduct ? true : false;
}

/**
 * @description cancels the subscription and returns a message
 * @param {string} subscriptionId - subscription identifier
 * @returns {string}
 */
function cancelSubscription(subscriptionID) {
  var subscription = getProductSubscriptionBySubscriptionID(subscriptionID);
  try {
    if (!subscription)
      throw new Error(
        Resource.msg("text.subscription.notfound", "subscription", null)
      );
    if (subscription.custom && subscription.custom.isActive) {
      // Sending subscription cancel notification
      emailHelpers.notifySubscriptionCancellation(subscription);
      Transaction.wrap(function () {
        subscription.custom.isActive = false;
        // Adding this attribute for tracking canceled subscriptions
        subscription.custom.lastCanceled = new Date();
      });
      return {
        successMessage: Resource.msg(
          "cancel.success.msg",
          "subscription",
          null
        ),
        homeLink: URLUtils.url("Home-Show").toString(),
      };
    }
  } catch (e) {
    Logger.error("Error in cancelling a subscription. Cause - {0}", e.message);
    return { errorMessage: e.message };
  }
}

/**
 * @description returns the date in string
 * @param {Date} dateObj
 * @returns {string}
 */
function dateToStrFunc(dateObj) {
  let dateStr = "";
  dateStr += dateObj.getFullYear() + "-";
  let month = dateObj.getMonth() + 1;
  dateStr += month.toString().padStart(2, "0") + "-";
  dateStr += dateObj.getDate().toString().padStart(2, "0");
  return dateStr;
}

/**
 * @description Formats a date object as "month/day/year" (e.g. "5/4/23")
 * @param {Date} dateObj - The date object to format
 * @returns {string} - The formatted date string
 */
function shortDateToStrFunc(dateObj) {
  let month = dateObj.getMonth() + 1;
  let day = dateObj.getDate();
  let year = dateObj.getFullYear().toString().substr(-2);
  return month + '/' + day + '/' + year;
}

/**
 * @description saves the next order date and returns a message
 * @param {string} subscriptionId - subscription identifier
 * @param {Date} preferredNextOrderDate - the user selected date to be updated to for the next occurence
 * @returns {string}
 */
function savePreferredOrderDate(subscriptionID, preferredNextOrderDate, futureOrdersChecked) {
  var subscription = getProductSubscriptionBySubscriptionID(subscriptionID);
  try {
    if (!subscription)
      throw new Error(
        Resource.msg("text.subscription.notfound", "subscription", null)
      );

    var preferredNextOrderDateStr = dateToStrFunc(preferredNextOrderDate);
    if (
      preferredNextOrderDateStr <= dateToStrFunc(new Date()) ||
      preferredNextOrderDateStr >=
        dateToStrFunc(subscription.custom.nextNextOrderDate)
    )
      throw new Error("Invalid");
    Transaction.wrap(function () {
        subscription.custom.nextOrderDate = preferredNextOrderDate;
        if(futureOrdersChecked) {
          var selectedOrderDate = new Date(preferredNextOrderDate);
          subscription.custom.selectedOrderDate = selectedOrderDate;
          subscription.custom.nextNextOrderDate = getNextPreferredOrderDate(
            subscription.custom.orderInterval,
            preferredNextOrderDate.getDate(),
            preferredNextOrderDate
          );
        }
    });
    // Sending subscription update notification
    emailHelpers.notifySubscriptionUpdatation(subscription);
    return {
      successMessage: Resource.msg(
        "text.savePreferredOrderDate.success.msg",
        "subscription",
        null
      ),
    };
  } catch (e) {
    Logger.error(
      "Error while saving user preferred next order date. Cause - {0}",
      e.message
    );
    return { errorMessage: e.message };
  }
}

/**
 * @description returns the next order date based the order date
 * @param {number} orderInterval - The selected subscription interval
 * @param {Date} orderDate - The current order date
 * @returns {Date}
 */
function getNextOrderDate(orderInterval, orderDate) {
  return getNextPreferredOrderDate(
    orderInterval,
    orderDate.getDate(),
    orderDate
  );
}

/**
 * @param {number} orderInterval - The selected subscription interval
 * @param {number} preferredDate - The date preferred by the customer
 * @param {Date} orderDate - The current order date
 * @returns {Date}
 * @description returns the next order date based on customer preferred date and the order date's month and year
 */
function getNextPreferredOrderDate(orderInterval, preferredDate, orderDate) {
  // Getting the first full date of the next order date
  var nextOrderDate = new Date(
    orderDate.getFullYear(),
    orderDate.getMonth() + orderInterval,
    1
  );
  // Getting the last date of the next order date
  var lastOrderDate = new Date(
    nextOrderDate.getFullYear(),
    nextOrderDate.getMonth() + 1,
    0
  ).getDate();
  // setting the date(either preferred or last date) for the nextOrderDate
  nextOrderDate.setDate(
    preferredDate > lastOrderDate ? lastOrderDate : preferredDate
  );
  return nextOrderDate;
}

/**
 * @description reactivates the subscription and returns a message
 * @param {string} subscriptionId - subscription identifier
 * @param {number} orderInterval - subscription order interval to be updated to
 * @param {number} quantity - subscription quantity to be updated to
 * @returns {string}
 */
function reactivateSubscription(subscriptionID, orderInterval, quantity) {
  var subscription = getProductSubscriptionBySubscriptionID(subscriptionID);
  var response = updateSubscriptionDetails(
    subscriptionID,
    orderInterval,
    quantity,
    true
  );
  if (response.errorMessage) {
    return response;
  }
  try {
    Transaction.wrap(function () {
      var currentDate = new Date();
      subscription.custom.nextOrderDate = currentDate;
      subscription.custom.nextNextOrderDate = getNextPreferredOrderDate(
        orderInterval,
        subscription.custom.selectedOrderDate.getDate(),
        currentDate
      );
      subscription.custom.isActive = true;
      subscription.custom.lastActivated=currentDate;
    });
    // Sending subscription reactivation notification
    emailHelpers.notifySubscriptionReactivation(subscription);
    return {
      successMessage: Resource.msg(
        "reactivate.success.msg",
        "subscription",
        null
      ),
      homeLink: URLUtils.url("Home-Show").toString(),
    };
  } catch (e) {
    Logger.error(
      "Error while reactivating a subscription. Cause - {0}",
      e.message
    );
    return { errorMessage: e.message };
  }
}

/**
 * @description updates the subscription and returns a message
 * @param {string} subscriptionId - subscription identifier
 * @param {number} orderInterval - subscription order interval to be updated to
 * @param {number} quantity - subscription quantity to be updated to
 * @param {bool} quantity - reactivate flag which defaults to false
 * @returns {string}
 */
function updateSubscriptionDetails(
  subscriptionID,
  orderInterval,
  quantity,
  reactivateFlag
) {
  var subscription = getProductSubscriptionBySubscriptionID(subscriptionID);

  try {
    // check if subscription was not found
    if (!subscription) {
      throw new Error(
        Resource.msg("text.subscription.notfound", "subscription", null)
      );
    }

    // Check if the subscription is active
    if (!reactivateFlag && !subscription.custom.isActive) {
      throw new Error(
        Resource.msg("text.subscription.inactive", "subscription", null)
      );
    }
    // Check if the quantity is orderable
    var product = ProductMgr.getProduct(subscription.custom.productId);
    var isProductOrderable =
      product &&
      product.getAvailabilityModel().isOrderable(parseFloat(quantity));
    if (!isProductOrderable) {
      throw new Error(
        Resource.msg("text.subscription.inorderable", "subscription", null)
      );
    }

    Transaction.wrap(function () {
      subscription.custom.orderInterval = orderInterval;
      subscription.custom.nextNextOrderDate = getNextPreferredOrderDate(
        orderInterval,
        subscription.custom.selectedOrderDate.getDate(),
        subscription.custom.nextOrderDate
      );
      subscription.custom.quantity = quantity;
    });
    // sending subscription update notification
    if (!reactivateFlag) {
      emailHelpers.notifySubscriptionUpdatation(subscription);
    }
    return {
      successMessage: Resource.msg("update.success.msg", "subscription", null),
    };
  } catch (e) {
    Logger.error("Error while updating a subscription. Cause - {0}", e.message);
    return {
      errorMessage: e.message,
    };
  }
}

/**
 * Returns the subscription price for a given product.
 * @param {dw.catalog.Product} apiProduct - The product object.
 * @returns {number} - The subscription price of the API product, or undefined if not found.
 */
function getSubscriptionPrice(apiProduct) {
  var subscriptionPrice;
  var priceModel = apiProduct.getPriceModel();
  if (priceModel) {
    var temp = priceModel.getPriceBookPrice(SUBSCRIPTION_PRICE_BOOK_NAME);
    if (temp != 0) {
      subscriptionPrice = temp;
    }
  }
  return subscriptionPrice;
}

/**
 * Returns the subscription price message for a given product.
 * @param {dw.catalog.Product} apiProduct - The product object.
 * @returns {String} - The subscription price message of the API product, or empty string if not found.
 */
function getSubscriptionMessage(apiProduct){

  var subscriptionMessage = '';
  if(apiProduct && apiProduct.custom && apiProduct.custom.subscriptionType){
      var type =  apiProduct.custom.subscriptionType;
      var saveValue = getSubscriptionSaveValue(apiProduct);
      if(type==SUBSCRIPTION_TYPE_PERCENT_OFF){
          subscriptionMessage = Resource.msgf('product.subscribe.percentoff', 'product', null, saveValue);
      } else if (type==SUBSCRIPTION_TYPE_AMOUNT_OFF){
          subscriptionMessage = Resource.msgf('product.subscribe.amountoff', 'product', null, saveValue);
      }
  }
  return subscriptionMessage;
}

/**
 * Returns the subscription price message for a given product.
 * @param {dw.catalog.Product} apiProduct - The product object.
 * @returns {number} - The subscription save value of the API product, or empty string if not found.
 */
function getSubscriptionSaveValue(apiProduct){
  var subscriptionSaveValue = 0;
  var salesPrice = apiProduct.priceModel.price.valueOrNull;
  var subscriptionPrice = getSubscriptionPrice(apiProduct);
  if(apiProduct && apiProduct.custom && apiProduct.custom.subscriptionType && salesPrice && subscriptionPrice){
      var type =  apiProduct.custom.subscriptionType;
      if(type==SUBSCRIPTION_TYPE_PERCENT_OFF){
          subscriptionSaveValue = Math.floor(((salesPrice - subscriptionPrice) / salesPrice) * HUNDRED);
      } else if (type==SUBSCRIPTION_TYPE_AMOUNT_OFF){
          subscriptionSaveValue = salesPrice - subscriptionPrice;
      }
  }
  return subscriptionSaveValue;
}

/**
 * Check if a payment instrument is valid by verifying the credit card expiration month, year, and expiration status.
 *
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument to be validated.
 * @returns {boolean} - true if the payment instrument is valid, false otherwise.
 */
function isValidPaymentInstrument(paymentInstrument) {
  return (
    paymentInstrument.creditCardExpirationMonth &&
    paymentInstrument.creditCardExpirationYear &&
    !paymentInstrument.creditCardExpired
  );
}

/**
 * Determines if a valid payment instrument is available from an array of payment instruments.
 * @param {Array} paymentInstruments - An array of payment instrument objects to check.
 * @param {string} defaultCreditCardUUID - The UUID of the default credit card payment method to check for.
 * @returns {boolean} Returns true if a valid payment instrument is available, otherwise false.
 */
function hasValidPaymentInstrumentAvailable(
  paymentInstruments,
  defaultCreditCardUUID
) {
  if (paymentInstruments && paymentInstruments.length > 0) {
    for (var i = 0; i < paymentInstruments.length; i++) {
      var paymentInstrument = paymentInstruments[i];
      if (
        defaultCreditCardUUID &&
        paymentInstrument.UUID == defaultCreditCardUUID
      ) {
        return isValidPaymentInstrument(paymentInstrument);
      }
    }
  }
  return false;
}

/**
 * Returns the default payment instrument from the provided list of payment instruments
 * @param {Array} paymentInstruments - The list of payment instruments to search through
 * @param {string} defaultCreditCardUUID - The UUID of the default credit card to find
 * @returns {dw.order.PaymentInstrument | null} - The payment instrument that matches the defaultCreditCardUUID, or null if not found
 */
function getPaymentInstrument(paymentInstruments, defaultCreditCardUUID) {
  if (paymentInstruments && paymentInstruments.length > 0) {
    for (var i = 0; i < paymentInstruments.length; i++) {
      var paymentInstrument = paymentInstruments[i];
      if (
        defaultCreditCardUUID &&
        paymentInstrument.UUID == defaultCreditCardUUID
      ) {
        return paymentInstrument;
      }
    }
  }
  return null;
}

/**
 * Determines if a valid credit card payment method is available for a customer profile or an original order.
 * @param {string} customerNo - The customer number.
 * @param {dw.order.Order} originalOrder - Customer's initial order.
 * @returns {boolean} Returns true if a valid credit card payment method is available, otherwise false.
 */
function isValidCreditCardAvailable(customerNo, originalOrder) {
  var customerProfile = CustomerMgr.getProfile(customerNo);
  // If the customer profile is found, check for a valid credit card payment method in the customer's wallet
  if (customerProfile) {
    // Get the UUID of the customer's default credit card payment method, if available
    var defaultCreditCardUUID = customerProfile.custom
      ? customerProfile.custom.defaultCreditCardUUID
      : null;
    var customerWallet = customerProfile.wallet;
    // If a default credit card payment method is available and the customer has a wallet
    if (defaultCreditCardUUID && customerWallet) {
      var paymentInstruments = customerWallet.paymentInstruments;
      if (
        hasValidPaymentInstrumentAvailable(
          paymentInstruments,
          defaultCreditCardUUID
        )
      ) {
        return true;
      }
    }
  }
  // If an customer profile is not available i.e. guest user, check for a valid payment instrument in the customer's intial order
  if (originalOrder) {
    return isValidPaymentInstrument(originalOrder.paymentInstruments[0]);
  }

  return false;
}

/**
 * @description returns the nextOrderDate limits for the upcoming tab in mySubscriptions page
 * @param {Object} subscriptionId - subscription identifier
 * @returns {Object}
 */
function getNextOrderDateLimits(product) {
  var response = {};
  if (
    product &&
    product.subscriptionAllowedInterval &&
    product.subscriptionAllowedInterval.length !== 0
  ) {
    var currentDate = new Date();
    var currentDateString = dateToStrFunc(currentDate);
    currentDate.setDate(currentDate.getDate()-1)
    var max = dateToStrFunc(getNextOrderDate(
      parseInt(product.subscriptionAllowedInterval[0])
      , currentDate));
    response = {
      min: currentDateString,
      max: max,
      value: currentDateString,
    };
  }
  return response;
}

/**
 * Retrieves the subscription details for each subscription product in the order.
 *
 * @param {dw.order.Order} order - The order object
 * @param {string} customerNo - The customer number
 * @returns {Object} Object containing the subscription details for each subscription product
 */
function getSubscriptionDetailsForOrder(order, customerNo) {
  var subscribedProductDetails = {};

  var subscribedProductLineItems = getSubscribedProductLineItems(order);

  collections.forEach(subscribedProductLineItems, function (pli) {
    var productID = pli.productID;
    var subscriptionProduct = getSubscriptionProduct(pli.custom.subscriptionID);
    if (subscriptionProduct && subscriptionProduct.custom){
      subscribedProductDetails[productID] = {
        orderInterval: subscriptionProduct.custom.orderInterval,
        nextOrderDate: dateToStrFunc(subscriptionProduct.custom.nextOrderDate),
        quantity: subscriptionProduct.custom.quantity,
      };
    } else {
      subscribedProductDetails[productID] = {
        orderInterval: pli.custom.subscriptionInterval,
        nextOrderDate: dateToStrFunc(getNextPreferredOrderDate(pli.custom.subscriptionInterval, pli.custom.selectedOrderDate, pli.custom.selectedOrderDate))
        // nextOrderDate: dateToStrFunc(getNextOrderDate(pli.custom.subscriptionInterval,new Date())),
      };
    }
  });

  return subscribedProductDetails;
}


function isSubscriptionEnabled(productId) {
  var product = ProductMgr.getProduct(productId);
  if (product && product.custom && product.custom.subscriptionEnabled) {
    return true;
  }
  return false;
}


function removeSubscription(subscriptionID) {
  var subscription = getProductSubscriptionBySubscriptionID(subscriptionID);
  try {
    Transaction.wrap(function () {
      CustomObjectMgr.remove(subscription);
      var x = 10;
    });
  } catch (e) {
    Logger.error(
      "Error in removing discontinued subscription.Cause - {0}",
      e.message
    );
  }
  
}

/**
 *
 * Checks the availability of a subscription product and sends email notifications if necessary.
 * @function
 * @param {Object} subscriptionProduct - The subscription product object to check.
 */
function checkSubscriptionProductAvailability(subscriptionProduct) {
  // The time limit in days for resolving the delay due to item's stock
  var emailHelpers = require("~/cartridge/scripts/email/emailHelpers");
  var product = ProductMgr.getProduct(subscriptionProduct.custom.productId);

  // Send a subscription discontinued notification email if the product is not found or subscription is disabled.
  if (!isSubscriptionEnabled(subscriptionProduct.custom.productId)) {
    emailHelpers.sendSubscriptionDiscontinuedNotification(subscriptionProduct);
    //Remove subscription if product is deleted 
    if(!product){
      removeSubscription(subscriptionProduct.custom.ID);
    }
    
    return false;
  }
  var subscriptionOrderDate = subscriptionProduct.custom.nextOrderDate;
  subscriptionOrderDate.setHours(0, 0, 0, 0);
  var currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  if (
    !product
      .getAvailabilityModel()
      .isOrderable(parseFloat(subscriptionProduct.custom.quantity))
  ) {
    // Subscription delay notification will be sent only once if the product is out of stock on the subscription order date.
    if (subscriptionOrderDate.getDate() == currentDate.getDate()) {
      emailHelpers.sendSubscriptionDelayNotification(subscriptionProduct);
    }
    return false;
  }

  return true;
}

module.exports = {
  getSubscriptions: getSubscriptions,
  getSubscriptionActionUrls: getSubscriptionActionUrls,
  cancelSubscription: cancelSubscription,
  isAlreadySubscribed: isAlreadySubscribed,
  getSubscriptionProduct: getSubscriptionProduct,
  updateSubscriptionDetails: updateSubscriptionDetails,
  getSubscriptionPrice: getSubscriptionPrice,
  reactivateSubscription: reactivateSubscription,
  savePreferredOrderDate: savePreferredOrderDate,
  getNextOrderDateLimits: getNextOrderDateLimits,
  getNextPreferredOrderDate: getNextPreferredOrderDate,
  isValidPaymentInstrument: isValidPaymentInstrument,
  isValidCreditCardAvailable: isValidCreditCardAvailable,
  dateToStrFunc: dateToStrFunc,
  shortDateToStrFunc: shortDateToStrFunc,
  getPaymentInstrument: getPaymentInstrument,
  hasValidPaymentInstrumentAvailable: hasValidPaymentInstrumentAvailable,
  getSubscriptionDetailsForOrder: getSubscriptionDetailsForOrder,
  getSubscriptionMessage: getSubscriptionMessage,
  getSubscriptionSaveValue: getSubscriptionSaveValue,
  checkSubscriptionProductAvailability:checkSubscriptionProductAvailability,
  isSubscriptionEnabled:isSubscriptionEnabled,
  getSubscribedProductLineItems:getSubscribedProductLineItems,
};
