"use strict";

var server = require("server");
server.extend(module.superModule);

/**
 * Product-Variation : This endpoint is called when a shopper changes a product defining attribute
 * @name Base/Product-Variation
 * @function
 * @memberof Product
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.append("Variation", function (req, res, next) {
  var renderTemplateHelper = require("*/cartridge/scripts/renderTemplateHelper");
  var viewData = res.getViewData();
  var product = viewData.product;
  var subscriptionTemplate = "product/components/productSubscription";
  var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
  var subscriptionContext = {product: product, PDPDateLimits: subscriptionHelpers.getNextOrderDateLimits(product)};
  viewData.product.subscriptionHtml = renderTemplateHelper.getRenderedHtml(
      subscriptionContext,
      subscriptionTemplate,
  );
  res.setViewData(viewData);
  next();
});

module.exports = server.exports();
