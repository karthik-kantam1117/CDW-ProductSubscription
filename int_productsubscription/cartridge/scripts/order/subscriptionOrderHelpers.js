"use strict";

var Logger = require("dw/system/Logger");
var Transaction = require("dw/system/Transaction");
var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var BasketMgr = require("dw/order/BasketMgr");
var OrderMgr = require("dw/order/OrderMgr");
var Order = require('dw/order/Order');
var ProductMgr = require("dw/catalog/ProductMgr");
var ShippingMgr = require("dw/order/ShippingMgr");
var CustomerMgr = require("dw/customer/CustomerMgr");
var HookMgr = require("dw/system/HookMgr");
var PaymentMgr = require("dw/order/PaymentMgr");
const SUBSCRIPTION_STATUS_NOT_APPLICABLE = 0;
const SUBSCRIPTION_STATUS_PENDING = 1;
const SUBSCRIPTION_STATUS_COMPLETE = 2;

/**
 * Populates the given order address with the details from the original order address.
 * @param {dw.order.OrderAddress} orderAddress - The order address to be populated.
 * @param {dw.order.OrderAddress} originalOrderAddress - The original order address containing the details to be copied.
 */
function populateOrderAddress(orderAddress, originalOrderAddress) {
  orderAddress.setFirstName(originalOrderAddress.firstName);
  orderAddress.setLastName(originalOrderAddress.lastName);
  orderAddress.setPhone(originalOrderAddress.phone);
  orderAddress.setAddress1(originalOrderAddress.address1);
  orderAddress.setAddress2(originalOrderAddress.address2);
  orderAddress.setCity(originalOrderAddress.city);
  orderAddress.setStateCode(originalOrderAddress.stateCode);
  orderAddress.setPostalCode(originalOrderAddress.postalCode);
  orderAddress.setCountryCode(originalOrderAddress.stateCode);
}

/**
  Populates the basket with the given subscription product.
* @param {dw.order.Basket} basket - The basket to populate with the subscription product.
* @param {Object} subscriptionProduct - An object containing information about the subscription product.
* @returns {void}
*/
function populateBasket(basket, subscriptionProduct) {
  var subscriptionHelpers = require("~/cartridge/scripts/subscription/subscriptionHelpers");
  var originalOrder = OrderMgr.getOrder(subscriptionProduct.originalOrderNo);
  var productId = subscriptionProduct.productId;
  var product = ProductMgr.getProduct(productId);

  // Get the subscription price for the product
  var subscriptionPrice = subscriptionHelpers.getSubscriptionPrice(product);

  // Get the default shipment in the basket
  var shipmentIterator = basket.getShipments().iterator();
  var defaultShipment = null;
  if (shipmentIterator.hasNext()) {
    defaultShipment = shipmentIterator.next();
  }

  // Set the default shipping method for the shipment
  Transaction.begin();
  var defaultShippingMethod = ShippingMgr.getDefaultShippingMethod();
  defaultShipment.setShippingMethod(defaultShippingMethod);
  // Create billing address
  var billingAddress = basket.createBillingAddress();
  populateOrderAddress(billingAddress, originalOrder.billingAddress);
  // Create shipping address
  var shippingAddress = defaultShipment.getShippingAddress();
  if (!shippingAddress) {
    shippingAddress = defaultShipment.createShippingAddress();
  }

  populateOrderAddress(
    shippingAddress,
    originalOrder.defaultShipment.shippingAddress
  );

  var productLineItem = basket.createProductLineItem(
    productId,
    defaultShipment
  );

  if (productLineItem) {
    productLineItem.custom.subscriptionInterval =
      subscriptionProduct.orderInterval;
    productLineItem.custom.subscriptionItem = true;
    productLineItem.setQuantityValue(parseInt(subscriptionProduct.quantity));
    productLineItem.setPriceValue(parseFloat(subscriptionPrice));
  }
  Transaction.commit();
}

/**
 * Updates the subscription product information.
 * @param {Object} subscriptionProduct - The subscription product to update.
 */
function updateSubscriptionProductInfo(subscriptionProduct) {
  var subscriptionHelpers = require("~/cartridge/scripts/subscription/subscriptionHelpers");
  var subscriptionID = subscriptionProduct.ID;
  var query = "custom.ID={0}";
  var subscriptionProductInfo = CustomObjectMgr.queryCustomObject(
    "ProductSubscriptions",
    query,
    subscriptionID
  );
  // Update the subscription product information
  let nextNextOrderDate = subscriptionProductInfo.custom.nextNextOrderDate;
  subscriptionProductInfo.custom.nextOrderDate = nextNextOrderDate;
  subscriptionProductInfo.custom.nextNextOrderDate =
    subscriptionHelpers.getNextPreferredOrderDate(
      subscriptionProduct.orderInterval,
      subscriptionProductInfo.custom.selectedOrderDate.getDate(),
      nextNextOrderDate
    );
}

/**
 * Updates the details of a payment instrument in an order.
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument to update.
 * @param {dw.order.Order} order - The order containing the payment instrument to update.
 * @returns {void}
 */
function updatePaymentInstrumentDetails(paymentInstrument, order) {
  try {
    // Get the payment processor for the payment method of the payment instrument
    var paymentProcessor = PaymentMgr.getPaymentMethod(
      paymentInstrument.paymentMethod
    ).paymentProcessor;

    var orderPaymentInstrument = order.createPaymentInstrument(paymentInstrument.paymentMethod,order.totalGrossPrice);
    // Set the transaction ID and payment processor for the payment transaction
    order.paymentInstrument.paymentTransaction.setTransactionID(
      order.getOrderNo()
    );
    order.paymentInstrument.paymentTransaction.setPaymentProcessor(
      paymentProcessor
    );

    // Set the credit card details for the payment instrument
    order.paymentInstrument.setCreditCardNumber(
      paymentInstrument.getCreditCardNumber()
    );
    order.paymentInstrument.setCreditCardHolder(
      paymentInstrument.getCreditCardHolder()
    );
    order.paymentInstrument.setCreditCardType(
      paymentInstrument.getCreditCardType()
    );
    order.paymentInstrument.setCreditCardExpirationMonth(
      paymentInstrument.getCreditCardExpirationMonth()
    );
    order.paymentInstrument.setCreditCardExpirationYear(
      paymentInstrument.getCreditCardExpirationYear()
    );
    order.paymentInstrument.setCreditCardToken(
      paymentInstrument.getCreditCardToken()
    );
  } catch (e) {
    Logger.error(
      "Error in updating payment instrument details in order. Cause - {0}",
      e.message
    );
  }
}

/**
 * Creates a subscription order for the given subscription product.
 * @param {Object} subscriptionProduct - The subscription product information.
 * @returns {void}
 */
function createSubscriptionOrder(subscriptionProduct) {

  var emailHelpers = require("~/cartridge/scripts/email/emailHelpers");
  var subscriptionHelpers = require("~/cartridge/scripts/subscription/subscriptionHelpers");
  var order;
  var orderNo;
  var basket;
  var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");

  // Create Order
  try {
    Transaction.begin();

    // setting the subscription pli
    var originalOrder = OrderMgr.getOrder(subscriptionProduct.originalOrderNo);
    var iter = originalOrder.productLineItems.iterator();    
    var pli;
    while(iter.hasNext()) {
        pli = iter.next();
        if(pli.productID === subscriptionProduct.productId) {
            break;
        }
    }

    // If it's a delayed first order
    if (originalOrder.status == originalOrder.ORDER_STATUS_CREATED) {
      var fraudDetectionStatus =
        originalOrder.getConfirmationStatus() ===
        Order.CONFIRMATION_STATUS_NOTCONFIRMED
          ? "flag"
          : "success";
      var placeOrderResult = COHelpers.placeOrder(
        originalOrder,
        fraudDetectionStatus,
        true
      );
      if (placeOrderResult.error) {
        throw new Error();
      } else {
        pli.custom.subscriptionStatus = SUBSCRIPTION_STATUS_COMPLETE;
        updateSubscriptionProductInfo(subscriptionProduct);
      }
    } else if (
      pli.custom.subscriptionStatus.value === SUBSCRIPTION_STATUS_PENDING
    ) {
      pli.custom.subscriptionStatus = SUBSCRIPTION_STATUS_COMPLETE;
      updateSubscriptionProductInfo(subscriptionProduct);
    } else if (
      pli.custom.subscriptionStatus.value === SUBSCRIPTION_STATUS_COMPLETE
    ) {
      try {
        // Login as externally authenticated user
        CustomerMgr.createExternallyAuthenticatedCustomer(
          "authenticationProviderId",
          "externalId"
        );
        CustomerMgr.loginExternallyAuthenticatedCustomer(
          "authenticationProviderId",
          "externalId",
          false
        );

        basket = BasketMgr.currentOrNewBasket;

        // We'll populate the basket with the subscription products based on the original order
        populateBasket(basket, subscriptionProduct);
      } catch (e) {
        Logger.error(
          "Subscription order creation failed due to an error populating the basket. Cause - {0}",
          e.message
        );
        return;
      }
      HookMgr.callHook("dw.order.calculate", "calculate", basket);

      orderNo = OrderMgr.createOrderNo();
      order = OrderMgr.createOrder(basket, orderNo);
      order.setCustomer(originalOrder.customer);
      order.setCustomerEmail(originalOrder.customerEmail);
      order.setCustomerName(originalOrder.customerName);
      order.productLineItems[0].custom.subscriptionStatus =
        SUBSCRIPTION_STATUS_COMPLETE;
      order.productLineItems[0].custom.subscriptionID =
      subscriptionProduct.ID;
      var customerNo = subscriptionProduct.customerNo;
      var customerProfile = CustomerMgr.getProfile(customerNo);
      var paymentInstrument;

      if (
        customerProfile &&
        customerProfile.custom &&
        customerProfile.custom.defaultCreditCardUUID
      ) {
        var defaultCreditCardUUID =
          customerProfile.custom.defaultCreditCardUUID;
        var paymentInstruments = customerProfile.wallet.paymentInstruments;
        paymentInstrument = subscriptionHelpers.getPaymentInstrument(
          paymentInstruments,
          defaultCreditCardUUID
        );
        if (
          !subscriptionHelpers.hasValidPaymentInstrumentAvailable(
            paymentInstruments,
            defaultCreditCardUUID
          )
        ) {
          throw "No Valid Payment Instrument Available";
        }
      } else {
        paymentInstrument = originalOrder.paymentInstruments[0];
      }
      //Updating the payment instruments details for current order
      updatePaymentInstrumentDetails(paymentInstrument, order);

      order.setExportStatus(order.EXPORT_STATUS_READY);
      order.setConfirmationStatus(order.CONFIRMATION_STATUS_CONFIRMED);
      updateSubscriptionProductInfo(subscriptionProduct);

      // Sending subscription order confirmation notification
      emailHelpers.notifyOrderConfirmation(order, customerNo, true);
    }
    Transaction.commit();
  } catch (e) {
    Logger.error(
      "Error in subscription order creation. Cause - {0}",
      e.message
    );
    // Sending subscription order payment failure notification
    emailHelpers.notifySubscriptionPaymentFailure(
      order,
      customerNo,
      paymentInstrument?paymentInstrument.paymentMethod:""
    );
    Transaction.wrap(function () {
      BasketMgr.deleteBasket(basket);
    });
  }
}

module.exports = {
  createSubscriptionOrder: createSubscriptionOrder,
};
