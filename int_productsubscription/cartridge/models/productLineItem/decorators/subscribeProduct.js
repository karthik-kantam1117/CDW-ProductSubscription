'use strict';
var Site = require("dw/system/Site");
var collections = require('*/cartridge/scripts/util/collections');
var priceHelper = require('*/cartridge/scripts/helpers/pricing');
var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
const SUBSCRIPTION_PRICE_BOOK_NAME =
  Site.current.getCustomPreferenceValue("subscriptionPriceBookName");

  /**
    * Renders pricing template for line item
    * @param {Object} price - Factory price
    * @return {string} - Rendered HTML
    */
  function getRenderedPrice(price) {
      var context = {
          price: price
      };
      return priceHelper.renderHtml(priceHelper.getHtmlContext(context));
  } 

  function updateSubscriptionProductEligibleIntervals(pli) {
    const STRING_COMMA_SEPARATOR = ',';
    var ProductMgr = require('dw/catalog/ProductMgr');
    var apiProduct = ProductMgr.getProduct(pli.productID);
    var subscriptionAllowedInterval = [];
    if (!empty(apiProduct.custom.subscriptionAllowedInterval)) {
      subscriptionAllowedInterval =
        apiProduct.custom.subscriptionAllowedInterval.split(
          STRING_COMMA_SEPARATOR
        );
    }
    return subscriptionAllowedInterval;
  }

module.exports = function (object, lineItem) {
  if (lineItem && lineItem.custom && lineItem.custom.subscriptionItem) {
    Object.defineProperty(object, "subscriptionItem", {
      enumerable: true,
      value: lineItem.custom.subscriptionItem,
    });
    Object.defineProperty(object, "subscriptionInterval", {
      enumerable: true,
      value: lineItem.custom.subscriptionInterval,
    });
    Object.defineProperty(object, "subscriptionAllowedInterval", {
      enumerable: true,
      value: updateSubscriptionProductEligibleIntervals(lineItem),
    })
    Object.defineProperty(object, "subscriptionMessage", {
      enumerable: true,
      value: subscriptionHelpers.getSubscriptionMessage(lineItem.product),
    })
    var subscriptionPrice = subscriptionHelpers.getSubscriptionPrice(lineItem.product);

    if (object.price && object.price.sales && object.price.sales.value) {
      var salesPrice = object.price.sales.value;

      object.price.list.value = salesPrice;
      object.price.list.decimalPrice = salesPrice;
      object.price.list.formatted = "$" + salesPrice;

      object.price.sales.value = subscriptionPrice.value;
      object.price.sales.decimalPrice = subscriptionPrice.value;
      object.price.sales.formatted = "$" + subscriptionPrice.value;

      Object.defineProperty(object, "subscriptionRenderedPrice", {
        enumerable: true,
        value: getRenderedPrice(object.price),
      });
    }
  }
};