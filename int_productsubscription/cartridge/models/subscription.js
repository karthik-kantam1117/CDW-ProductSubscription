"use strict";

var URLUtils = require("dw/web/URLUtils");
var Resource = require("dw/web/Resource");
var collections = require("*/cartridge/scripts/util/collections");
var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
var ProductMgr = require("dw/catalog/ProductMgr");
var Site = require("dw/system/Site");
var ProductFactory = require("*/cartridge/scripts/factories/product");

const SUBSCRIPTION_PRICE_BOOK_NAME =
  Site.current.getCustomPreferenceValue("subscriptionPriceBookName");

function updateSubscriptionOrderInterval(customerNo, pli) {
  var subscriptionProduct = subscriptionHelpers.getSubscriptionProduct(
    pli.custom.subscriptionID
  );
  pli.interval = subscriptionProduct.orderInterval;
}

function updateSubscriptionProductEligibleIntervals(pli) {
  var apiProduct = ProductMgr.getProduct(pli.id);
  var subscriptionAllowedInterval = [];
  if (!empty(apiProduct.custom.subscriptionAllowedInterval)) {
    subscriptionAllowedInterval =
      apiProduct.custom.subscriptionAllowedInterval.split(
        STRING_COMMA_SEPARATOR
      );
  }
  pli.allowedIntervals = subscriptionAllowedInterval;
}

function updateSubscriptionProductPrice(pli) {
  var apiProduct = ProductMgr.getProduct(pli.id);
  var subscriptionPrice;
  var priceModel = apiProduct.getPriceModel();
  if (priceModel) {
    subscriptionPrice = priceModel.getPriceBookPrice(
      SUBSCRIPTION_PRICE_BOOK_NAME
    );
  }
  pli.subscriptionPrice = subscriptionPrice;
}

function createProductLineItemsObject(allLineItems, view, customerNo) {
  var lineItems = [];

  collections.forEach(allLineItems, function (item) {
    // when item's category is unassigned, return a lineItem with limited attributes
    if (!item.product) {
      lineItems.push({
        id: item.productID,
        sid: item.custom.subscriptionID,
        quantity: item.quantity.value,
        productName: item.productName,
        UUID: item.UUID,
        noProduct: true,
        images: {
          small: [
            {
              url: URLUtils.staticURL("/images/noimagelarge.png"),
              alt: Resource.msgf("msg.no.image", "common", null),
              title: Resource.msgf("msg.no.image", "common", null),
            },
          ],
        },
      });
      return;
    }
    var options = collections.map(
      item.optionProductLineItems,
      function (optionItem) {
        return {
          optionId: optionItem.optionID,
          selectedValueId: optionItem.optionValueID,
        };
      }
    );

    var bonusProducts = null;

    if (
      !item.bonusProductLineItem &&
      item.custom.bonusProductLineItemUUID &&
      item.custom.preOrderUUID
    ) {
      bonusProducts = [];
      collections.forEach(allLineItems, function (bonusItem) {
        if (
          !!item.custom.preOrderUUID &&
          bonusItem.custom.bonusProductLineItemUUID === item.custom.preOrderUUID
        ) {
          var bpliOptions = collections.map(
            bonusItem.optionProductLineItems,
            function (boptionItem) {
              return {
                optionId: boptionItem.optionID,
                selectedValueId: boptionItem.optionValueID,
              };
            }
          );
          var params = {
            pid: bonusItem.product.ID,
            quantity: bonusItem.quantity.value,
            variables: null,
            pview: "bonusProductLineItem",
            containerView: view,
            lineItem: bonusItem,
            options: bpliOptions,
          };

          bonusProducts.push(ProductFactory.get(params));
        }
      });
    }

    var params = {
      pid: item.product.ID,
      quantity: item.quantity.value,
      variables: null,
      containerView: view,
      lineItem: item,
      options: options,
    };
    var newLineItem = ProductFactory.get(params);
    if(item.custom && item.custom.subscriptionID)
      newLineItem.sid = item.custom.subscriptionID;
    newLineItem.bonusProducts = bonusProducts;
    if (
      newLineItem.bonusProductLineItemUUID === "bonus" ||
      !newLineItem.bonusProductLineItemUUID
    ) {
      lineItems.push(newLineItem);
    }
  });
  return lineItems;
}

function createSubscriptionDetails(subscriptionItems, customerNo) {
  var subscriptionDetails = [];
  for (let item of subscriptionItems) {
    var subscriptionProduct = subscriptionHelpers.getSubscriptionProduct(item.sid);
    var nextOrderDate = subscriptionProduct.custom.nextOrderDate;
    var orderInterval = subscriptionProduct.custom.orderInterval;
    var nextNextOrderDate = subscriptionProduct.custom.nextNextOrderDate;

    var dateToStrFunc = (dateObj) => {
      let dateStr = "";
      dateStr += dateObj.getFullYear() + "-";
      let month = dateObj.getMonth() + 1;
      dateStr += month.toString().padStart(2, "0") + "-";
      dateStr += dateObj.getDate().toString().padStart(2, "0");
      return dateStr;
    };
    var nextNextOrderDateDisplay = new Date(nextNextOrderDate);
    nextNextOrderDateDisplay.setDate(nextNextOrderDateDisplay.getDate()-1);
    
    var currentDateDisplay = new Date();
    currentDateDisplay.setDate(currentDateDisplay.getDate()+1);
    var subscriptionEnabled = subscriptionHelpers.isSubscriptionEnabled(subscriptionProduct.custom.productId);
    var subscriptionDetail = {
      sid: subscriptionProduct.custom.ID,
      quantity: subscriptionProduct.custom.quantity,
      orderInterval: orderInterval,
      currentDateDisplay: dateToStrFunc(currentDateDisplay),
      nextOrderDateDisplay: dateToStrFunc(nextOrderDate),
      nextNextOrderDateDisplay: dateToStrFunc(nextNextOrderDateDisplay),
      subscriptionEnabled :subscriptionEnabled,
    };
    subscriptionDetails.push(subscriptionDetail);
  }
  return subscriptionDetails;
}
/**
 * @constructor
 * @param {*} customer
 * @param {*} productLineItemsModel
 */
function Subscription(activeSubscriptions, view, customer) {
  var customerNo = customer.profile.customerNo;
  if (activeSubscriptions) {
    this.items = createProductLineItemsObject(
      activeSubscriptions,
      view,
      customerNo
    );
    this.subscriptionDetails = createSubscriptionDetails(
      this.items,
      customerNo
    );
  } else {
    this.items = [];
    this.totalQuantity = 0;
  }
}

module.exports = Subscription;
