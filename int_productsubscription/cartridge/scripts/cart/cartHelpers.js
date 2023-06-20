"use strict";
var base = module.superModule;
var ProductMgr = require("dw/catalog/ProductMgr");
var collections = require("*/cartridge/scripts/util/collections");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var Resource = require("dw/web/Resource");

/**
 * Find all line items that contain the product specified.  A product can appear in different line
 * items that have different option selections or in product bundles.
 *
 * @param {string} productId - Product ID to match
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @return {Object} properties includes,
 *                  matchingProducts - collection of matching products
 *                  uuid - string value for the last product line item
 * @return {dw.order.ProductLineItem[]} - Filtered list of product line items matching productId
 */
 function getMatchingProducts(productId, productLineItems,isSubscribeProduct) {
  var matchingProducts = [];
  var uuid;

  collections.forEach(productLineItems, function (item) {
    var itemSubscribed = item.custom.subscriptionItem === true ? true : false;
    if (item.productID === productId && !item.productListItem && (itemSubscribed === isSubscribeProduct)) {
      matchingProducts.push(item);
      uuid = item.UUID;
    }
  });

  return {
    matchingProducts: matchingProducts,
    uuid: uuid,
  };
}

/**
 * Filter all the product line items matching productId and
 * has the same bundled items or options in the cart
 * @param {dw.catalog.Product} product - Product object
 * @param {string} productId - Product ID to match
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @return {dw.order.ProductLineItem[]} - Filtered all the product line item matching productId and
 *     has the same bundled items or options
 */
 function getExistingProductLineItemsInCart(
  product,
  productId,
  productLineItems,
  childProducts,
  options,isSubscribeProduct
) {
  var matchingProductsObj = getMatchingProducts(productId, productLineItems,isSubscribeProduct);
  var matchingProducts = matchingProductsObj.matchingProducts;
  var productLineItemsInCart = matchingProducts.filter(function (
    matchingProduct
  ) {
    return product.bundle
      ? base.allBundleItemsSame(
          matchingProduct.bundledProductLineItems,
          childProducts
        )
      : base.hasSameOptions(
          matchingProduct.optionProductLineItems,
          options || []
        );
  });

  return productLineItemsInCart;
}

/**
 * Filter the product line item matching productId and
 * has the same bundled items or options in the cart
 * @param {dw.catalog.Product} product - Product object
 * @param {string} productId - Product ID to match
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @return {dw.order.ProductLineItem} - get the first product line item matching productId and
 *     has the same bundled items or options
 */
 function getExistingProductLineItemInCart(
  product,
  productId,
  productLineItems,
  childProducts,
  options,isSubscribeProduct
) {
  return getExistingProductLineItemsInCart(
    product,
    productId,
    productLineItems,
    childProducts,
    options,
    isSubscribeProduct
  )[0];
}

/**
 * Adds a product to the cart. If the product is already in the cart it increases the quantity of
 * that product.
 * @param {dw.order.Basket} currentBasket - Current users's basket
 * @param {string} productId - the productId of the product being added to the cart
 * @param {number} quantity - the number of products to the cart
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @param {string} storeId - store id
 * @param {Object} req - The local instance of the request object
 * @return {Object} returns an error object
 */
 function addProductToCart(
  currentBasket,
  productId,
  quantity,
  childProducts,
  options,
  storeId,
  req
) {
  var availableToSell;
  var defaultShipment = currentBasket.defaultShipment;
  var perpetual;
  var product = ProductMgr.getProduct(productId);
  var productInCart;
  var productLineItems = currentBasket.productLineItems;
  var productQuantityInCart;
  var quantityToSet;
  var optionModel = productHelper.getCurrentOptionModel(
    product.optionModel,
    options
  );
  var result = {
    error: false,
    message: Resource.msg("text.alert.addedtobasket", "product", null),
  };
  var isSubscribeProduct =
    req && req.form && req.form.isSubscribeProduct === "true" ? true : false;


  var totalQtyRequested = 0;
  var canBeAdded = false;

  if (product.bundle) {
    canBeAdded = checkBundledProductCanBeAdded(
      childProducts,
      productLineItems,
      quantity
    );
  } else {
    totalQtyRequested =
      quantity + base.getQtyAlreadyInCart(productId, productLineItems);
    perpetual = product.availabilityModel.inventoryRecord.perpetual;
    canBeAdded =
      perpetual ||
      totalQtyRequested <= product.availabilityModel.inventoryRecord.ATS.value;
  }

  if (!canBeAdded) {
    result.error = true;
    result.message = Resource.msgf(
      "error.alert.selected.quantity.cannot.be.added.for",
      "product",
      null,
      product.availabilityModel.inventoryRecord.ATS.value,
      product.name
    );
    return result;
  }

  productInCart = getExistingProductLineItemInCart(
    product,
    productId,
    productLineItems,
    childProducts,
    options,
    isSubscribeProduct
  );

  if (productInCart) {
    var isProductInCartSubscribed =
      productInCart.custom.subscriptionItem === true ? true : false;
    if (isProductInCartSubscribed  === isSubscribeProduct) {
      productQuantityInCart = productInCart.quantity.value;
      quantityToSet = quantity
        ? quantity + productQuantityInCart
        : productQuantityInCart + 1;
      availableToSell =
        productInCart.product.availabilityModel.inventoryRecord.ATS.value;

      if (availableToSell >= quantityToSet || perpetual) {
        productInCart.setQuantityValue(quantityToSet);
        result.uuid = productInCart.UUID;
      } else {
        result.error = true;
        result.message =
          availableToSell === productQuantityInCart
            ? Resource.msg("error.alert.max.quantity.in.cart", "product", null)
            : Resource.msg(
                "error.alert.selected.quantity.cannot.be.added",
                "product",
                null
              );
      }
    }
  } else {
    var productLineItem;
    productLineItem = base.addLineItem(
      currentBasket,
      product,
      quantity,
      childProducts,
      optionModel,
      defaultShipment
    );

    result.uuid = productLineItem.UUID;
  }

  return result;
}
function itemExists(currentBasket,productId){
  var product = ProductMgr.getProduct(productId);
  var productLineItems = currentBasket.productLineItems;
  var options=[];
  var childProducts = [];
  var isSubscribeProduct = false;
  var result = {};
  var productInCart = getExistingProductLineItemInCart(
    product,
    productId,
    productLineItems,
    childProducts,
    options,
    isSubscribeProduct
  );
  if(productInCart){
    return true;
  }
  return false;

}
module.exports = {
  addProductToCart: addProductToCart,
  itemExists:itemExists,
};
Object.keys(base).forEach(function (prop) {
  if (!module.exports.hasOwnProperty(prop)) {
    module.exports[prop] = base[prop];
  }
});
