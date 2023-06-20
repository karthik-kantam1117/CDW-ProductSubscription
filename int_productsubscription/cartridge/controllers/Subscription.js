"use strict";

var server = require("server");
const subscriptionObject = "ProductSubscriptions";

var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var userLoggedIn = require("*/cartridge/scripts/middleware/userLoggedIn");
var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var OrderMgr = require("dw/order/OrderMgr");
var ProductLineItemsModel = require("*/cartridge/models/productLineItems");
var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
var SubscriptionModel = require("*/cartridge/models/subscription");
var URLUtils = require("dw/web/URLUtils");
var Resource = require('dw/web/Resource');
var renderTemplateHelper = require("*/cartridge/scripts/renderTemplateHelper.js");


/**
 * Subscription-Show : This endpoint is called when a shopper visits the My Subscriptions page.
 * @name Subscription-Show
 * @function
 * @memberof Subscription
 * @param {middleware} - userLoggedIn.validateLoggedIn
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.get("Show", userLoggedIn.validateLoggedIn, function (req, res, next) {
  var subscriptionType = 'active';
  var currentCustomer = req.currentCustomer;
  var activeSubscriptions = subscriptionHelpers.getSubscriptions(
    currentCustomer,
    subscriptionType
  );
  var actionUrls = subscriptionHelpers.getSubscriptionActionUrls();
  var subscriptionModel = new SubscriptionModel(
    activeSubscriptions,
    "basket",
    currentCustomer
  );

  res.render("account/subscription/mySubscriptions", {
    breadcrumbs: [
      {
        htmlValue: Resource.msg("global.home", "common", null),
        url: URLUtils.home().toString(),
      },
      {
        htmlValue: Resource.msg("page.title.myaccount", "account", null),
        url: URLUtils.url("Account-Show").toString(),
      },
      {
        htmlValue: Resource.msg(
          "title.subscriptions.active",
          "subscription",
          null
        ),
        // url: URLUtils.url("Account-Show").toString(),
      },
    ],
    items: subscriptionModel.items,
    subscriptionDetails: subscriptionModel.subscriptionDetails,
    subscriptionType: subscriptionType,
    actionUrls: actionUrls,
  });
  next();
});


/**
 * Subscription-TabSubscriptions : This endpoint is called when a shopper clicks on a tab
 * @name Subscription-TabSubscriptions
 * @function
 * @memberof Subscription
 * @param {querystringparameter} - subscriptionType - active or cancel or upcomingdeliveries
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.get("TabSubscriptions", function(req, res, next) {
  var subscriptionType = req.querystring.subscriptionType;
  var currentCustomer = req.currentCustomer;
  var subscriptions = subscriptionHelpers.getSubscriptions(
    currentCustomer,
    subscriptionType
  );
  var subscriptionModel = new SubscriptionModel(
    subscriptions,
    "basket",
    currentCustomer
  );
  var actionUrls = subscriptionHelpers.getSubscriptionActionUrls();

  var basketModelPlus = {
    items: subscriptionModel.items,
    subscriptionDetails: subscriptionModel.subscriptionDetails,
    actionUrls: actionUrls,
    subscriptionType: subscriptionType
  };
  var template = 'account/subscription/subscriptionProductsContainer';

  var subscriptionProductsContainerHtml = renderTemplateHelper.getRenderedHtml(
      basketModelPlus,
      template
  );

  res.json({
    subscriptionProductsContainerHtml: subscriptionProductsContainerHtml
  });
  next();
});

/**
 * Subscription-UpdateDetails : This endpoint is called when a shopper clicks the update button in the active tab of My Subscriptions page.
 * @name Subscription-UpdateDetails
 * @function
 * @memberof Subscription
 * @param {querystringparameter} - sid - subscription id
 * @param {querystringparameter} - orderInterval
 * @param {querystringparameter} - quantity
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post("UpdateDetails", function (req, res, next) {
  var subscriptionID = req.querystring.sid;
  var orderInterval = parseInt(req.querystring.orderInterval);
  var quantity = parseInt(req.querystring.quantity);
  var response = subscriptionHelpers.updateSubscriptionDetails(
    subscriptionID,
    orderInterval,
    quantity,
  );
  if(response.errorMessage !== undefined) {
    res.setStatusCode(500);
  }
  res.json(response);
  next();
});

/**
 * Subscription-CancelSubscription : This endpoint is called when a shopper clicks the cancel button in the active tab of My Subscriptions page.
 * @name Subscription-CancelSubscription
 * @function
 * @memberof Subscription
 * @param {querystringparameter} - sid - subscription id
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.get("CancelSubscription", function (req, res, next) {
  var subscriptionId = req.querystring.sid;

  var response = subscriptionHelpers.cancelSubscription(subscriptionId);

  if(response.errorMessage !== undefined) {
    res.setStatusCode(500);
  }
  res.json(response);
  next();
});

/**
 * Subscription-ReactivateSubscription : This endpoint is called when a shopper clicks the reactivate button in the cancelled tab of My Subscriptions page.
 * @name Subscription-ReactivateSubscription
 * @function
 * @memberof Subscription
 * @param {querystringparameter} - sid - subscription id
 * @param {querystringparameter} - orderInterval
 * @param {querystringparameter} - quantity
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.get("ReactivateSubscription", function (req, res, next) {
  var subscriptionId = req.querystring.sid;
  var orderInterval = parseInt(req.querystring.orderInterval);
  var quantity = parseInt(req.querystring.quantity);

  var response = subscriptionHelpers.reactivateSubscription(
    subscriptionId,
    orderInterval,
    quantity
  );
  if(response.errorMessage !== undefined) {
    res.setStatusCode(500);
  } 
  res.json(response);
  next();
});

/**
 * Subscription-SavePreferredOrderDate : This endpoint is called when a shopper clicks the update button near the next Order Date in the upcoming tab of My Subscriptions page.
 * @name Subscription-SavePreferredOrderDate
 * @function
 * @memberof Subscription
 * @param {querystringparameter} - sid - subscription id
 * @param {querystringparameter} - udate - user preferred next order date
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post("SavePreferredOrderDate", function(req, res, next) {
  var preferredNextOrderDate = new Date(req.querystring.udate);
  var futureOrdersChecked = JSON.parse(req.querystring.futureOrdersChecked);

  var response = subscriptionHelpers.savePreferredOrderDate(req.querystring.sid, preferredNextOrderDate, futureOrdersChecked);

  if(response.errorMessage !== undefined) {
    res.setStatusCode(500);
  }
  // res.json(response); replacing with the snippet beforfe next();
  var subscriptionType = 'upcomingdeliveries';
  var currentCustomer = req.currentCustomer;
  var subscriptions = subscriptionHelpers.getSubscriptions(
    currentCustomer,
    subscriptionType
  );
  var subscriptionModel = new SubscriptionModel(
    subscriptions,
    "basket",
    currentCustomer
  );
  var actionUrls = subscriptionHelpers.getSubscriptionActionUrls();

  var basketModelPlus = {
    items: subscriptionModel.items,
    subscriptionDetails: subscriptionModel.subscriptionDetails,
    actionUrls: actionUrls,
    subscriptionType: subscriptionType
  };
  var template = 'account/subscription/subscriptionProductsContainer';

  var subscriptionProductsContainerHtml = renderTemplateHelper.getRenderedHtml(
      basketModelPlus,
      template
  );

  res.json({
    subscriptionProductsContainerHtml: subscriptionProductsContainerHtml,
    successMessage: response.successMessage
  });
  next();
});

server.post("QuickOrder", function (req, res, next) {
  var BasketMgr = require("dw/order/BasketMgr");
  var HookMgr = require("dw/system/HookMgr");
  var Resource = require("dw/web/Resource");
  var URLUtils = require("dw/web/URLUtils");
  var Transaction = require("dw/system/Transaction");
  var CartModel = require("*/cartridge/models/cart");
  var ProductLineItemsModel = require("*/cartridge/models/productLineItems");
  var cartHelper = require("~/cartridge/scripts/cart/cartHelpers");
  var collections = require("*/cartridge/scripts/util/collections");
  var result={};
  var currentBasket = BasketMgr.getCurrentOrNewBasket();
  var childProducts = [];
  var options = [];
  var storeId = null;
  var productId = req.form.pid;
  var quantity = parseInt(req.form.quantity);
  if (currentBasket) {
    if(cartHelper.itemExists(currentBasket,productId)){
      result.error =true;
      result.message = Resource.msg(
        "error.alert.quickorder.product.already.exist",
        "subscription",
        null
      );
    }else{
      Transaction.wrap(function () {
        result = cartHelper.addProductToCart(
          currentBasket,
          productId,
          quantity,
          childProducts,
          options,
          storeId,
          req
        );
  
        if (!result.error) {
          cartHelper.ensureAllShipmentsHaveMethods(currentBasket);
          HookMgr.callHook("dw.order.calculate", "calculate", currentBasket);
        }
      });
    }
    
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

  var reportingURL = cartHelper.getReportingUrlAddToCart(
    currentBasket,
    result.error
  );

  res.json({
    reportingURL: reportingURL,
    quantityTotal: quantityTotal,
    message: result.message,
    cart: cartModel,
    newBonusDiscountLineItem: {},
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
module.exports = server.exports();
