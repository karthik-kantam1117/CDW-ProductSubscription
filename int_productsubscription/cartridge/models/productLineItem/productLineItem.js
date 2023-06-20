"use strict";

var subscribeProduct = require("*/cartridge/models/productLineItem/decorators/subscribeProduct");
var base = module.superModule;

/**
 * Decorate product with product line item information
 * @param {Object} product - Product Model to be decorated
 * @param {dw.catalog.Product} apiProduct - Product information returned by the script API
 * @param {Object} options - Options passed in from the factory
 * @returns {Object} - Decorated product model
 */
function productLineItem(product, apiProduct, options) {
  base.call(this, product, apiProduct, options);
  subscribeProduct(product, options.lineItem);
  return product;
}

module.exports = productLineItem;
