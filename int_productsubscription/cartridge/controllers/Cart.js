"use strict";

var server = require("server");

server.extend(module.superModule);

server.replace("AddProduct", function (req, res, next) {
  var BasketMgr = require("dw/order/BasketMgr");
  var HookMgr = require("dw/system/HookMgr");
  var Resource = require("dw/web/Resource");
  var URLUtils = require("dw/web/URLUtils");
  var Transaction = require("dw/system/Transaction");
  var CartModel = require("*/cartridge/models/cart");
  var ProductLineItemsModel = require("*/cartridge/models/productLineItems");
  var cartHelper = require("~/cartridge/scripts/cart/cartHelpers");
  var collections = require("*/cartridge/scripts/util/collections");

  var currentBasket = BasketMgr.getCurrentOrNewBasket();
  var previousBonusDiscountLineItems =
    currentBasket.getBonusDiscountLineItems();
  var productId = req.form.pid;
  var storeId = req.form.storeId ? req.form.storeId : null;
  var childProducts = Object.hasOwnProperty.call(req.form, "childProducts")
    ? JSON.parse(req.form.childProducts)
    : [];
  var options = req.form.options ? JSON.parse(req.form.options) : [];
  var quantity;
  var result;
  var pidsObj;

  if (currentBasket) {
    Transaction.wrap(function () {
      if (!req.form.pidsObj) {
        quantity = parseInt(req.form.quantity, 10);
        result = cartHelper.addProductToCart(
          currentBasket,
          productId,
          quantity,
          childProducts,
          options,
          storeId,
          req
        );
      } else {
        // product set
        pidsObj = JSON.parse(req.form.pidsObj);
        result = {
          error: false,
          message: Resource.msg("text.alert.addedtobasket", "product", null),
        };

        pidsObj.forEach(function (PIDObj) {
          quantity = parseInt(PIDObj.qty, 10);
          var pidOptions = PIDObj.options ? JSON.parse(PIDObj.options) : {};
          var PIDObjResult = cartHelper.addProductToCart(
            currentBasket,
            PIDObj.pid,
            quantity,
            childProducts,
            pidOptions,
            PIDObj.storeId,
            req
          );
          if (PIDObjResult.error) {
            result.error = PIDObjResult.error;
            result.message = PIDObjResult.message;
          }
        });
      }
      if (!result.error) {
        cartHelper.ensureAllShipmentsHaveMethods(currentBasket);
        HookMgr.callHook("dw.order.calculate", "calculate", currentBasket);
      }
    });
  }

  var quantityTotal = ProductLineItemsModel.getTotalQuantity(
    currentBasket.productLineItems
  );
  var cartModel = new CartModel(currentBasket);

  var urlObject = {
    url: URLUtils.url("Cart-ChooseBonusProducts").toString(),
    configureProductstUrl: URLUtils.url("Product-ShowBonusProducts").toString(),
    addToCartUrl: URLUtils.url("Cart-AddBonusProducts").toString(),
  };

  var newBonusDiscountLineItem = cartHelper.getNewBonusDiscountLineItem(
    currentBasket,
    previousBonusDiscountLineItems,
    urlObject,
    result.uuid
  );
  if (newBonusDiscountLineItem) {
    var allLineItems = currentBasket.allProductLineItems;
    collections.forEach(allLineItems, function (pli) {
      if (pli.UUID === result.uuid) {
        Transaction.wrap(function () {
          pli.custom.bonusProductLineItemUUID = "bonus";
          pli.custom.preOrderUUID = pli.UUID;
        });
      }
    });
  }

  var reportingURL = cartHelper.getReportingUrlAddToCart(
    currentBasket,
    result.error
  );

  res.json({
    reportingURL: reportingURL,
    quantityTotal: quantityTotal,
    message: result.message,
    cart: cartModel,
    newBonusDiscountLineItem: newBonusDiscountLineItem || {},
    error: result.error,
    pliUUID: result.uuid,
    minicartCountOfItems: Resource.msgf(
      "minicart.count",
      "common",
      null,
      quantityTotal
    ),
  });

  next();
});

server.append("AddProduct", function (req, res, next) {
  var BasketMgr = require("dw/order/BasketMgr");
  var Transaction = require("dw/system/Transaction");
  var collections = require("*/cartridge/scripts/util/collections");

  if (req && req.form && req.form.isSubscribeProduct === "true") {
    var currentBasket = BasketMgr.getCurrentOrNewBasket();
    if (!empty(req.form.subscriptionInterval) && !empty(req.form.selectedOrderDate)) {
      var subscriptionInterval = parseInt(req.form.subscriptionInterval, 10);
      var selectedOrderDate = new Date(req.form.selectedOrderDate);
      var viewData = res.getViewData();
      var allLineItems = currentBasket.allProductLineItems;
      collections.forEach(allLineItems, function (pli) {
        if (pli.UUID === viewData.pliUUID) {
          Transaction.wrap(function () {
            pli.custom.selectedOrderDate = selectedOrderDate;
            pli.custom.subscriptionInterval = subscriptionInterval;
            pli.custom.subscriptionItem = true;
          });
        }
      });
    }
  }
  next();
});

module.exports = server.exports();
