"use strict";

const TOP_PRODUCTS_LIMIT = 10;
const SUBSCRIPTION_OBJECT_NAME = "ProductSubscriptions";
var collections = require("*/cartridge/scripts/util/collections");
var numberOfCanceledSubscriptionsBeforeInterval = 0;
var numberOfCanceledSubscriptionsDuringInterval = 0;
var numberOfActiveSubscriptionsBeforeInterval = 0;

/**
 * Retrieves the count of unique subscribers from the given product subscriptions.
 *
 * @param {dw.util.Collection} productSubscriptions - The collection of product subscriptions.
 * @returns {number} - The count of unique subscribers.
 */
function getSubscribersCount(productSubscriptions) {
    var subscribers = new Set();
    if (productSubscriptions && productSubscriptions.length > 0) {
        for (var i = 0; i < productSubscriptions.length; i++) {
            var subscriptionProduct = productSubscriptions[i];
            if (subscriptionProduct && subscriptionProduct.custom && subscriptionProduct.custom.customerNo) {
                subscribers.add(subscriptionProduct.custom.customerNo);
            }
        }
    }
    return subscribers.size;
}

/**
 * Calculates the growth rate of active subscriptions during the specified interval.
 *
 * @param {dw.util.Collection} allSubscriptions - The collection of all subscriptions.
 * @param {dw.util.Collection} intervalSubscriptions - The collection of subscriptions within the interval.
 * @param {Date} intervalStartDate - The start date of the interval.
 * @param {Date} intervalEndDate - The end date of the interval.
 * @param {string} [productId] - The ID of the product, if provided.
 * @returns {number} - The growth rate percentage.
 */
function calculateGrowthRate (allSubscriptions, intervalSubscriptions, intervalStartDate, intervalEndDate, productId) {
    var growthRate = 0;
    var numberOfActiveSubscriptionsDuringInterval = 0;

    if (intervalSubscriptions && intervalSubscriptions.length) {
        collections.forEach(intervalSubscriptions, function (subscription) {
            if (
                subscription.custom &&
                subscription.custom.isActive &&
                subscription.creationDate >= intervalStartDate &&
                subscription.creationDate <= intervalEndDate
            ) {
                if (!productId || subscription.custom.productId == productId) {
                    numberOfActiveSubscriptionsDuringInterval++;
                }
            }
        });
    }

    if (numberOfActiveSubscriptionsDuringInterval !== 0 && numberOfActiveSubscriptionsBeforeInterval !== 0) {
        growthRate = (numberOfActiveSubscriptionsDuringInterval / numberOfActiveSubscriptionsBeforeInterval) * 100;
    }

    return growthRate;
}

/**
 * Calculates the churn rate of subscriptions during the specified interval.
 *
 * @param {dw.util.Collection} allSubscriptions - The collection of all subscriptions.
 * @param {dw.util.Collection} intervalSubscriptions - The collection of subscriptions within the interval.
 * @param {Date} startDate - The start date of the interval.
 * @param {Date} endDate - The end date of the interval.
 * @param {string} [productId] - The ID of the product, if provided.
 * @returns {number} - The churn rate percentage.
 */
function calculateChurnRate (allSubscriptions, intervalSubscriptions, startDate, endDate, productId) {
    var churnRate = 0;

    // Count the number of active subscriptions before the interval
    if(allSubscriptions && allSubscriptions.length){
        collections.forEach(allSubscriptions, function (subscription) {
            if (subscription.custom && subscription.custom.isActive && subscription.creationDate < startDate) {
                if (!productId || subscription.custom.productId == productId) {
                    numberOfActiveSubscriptionsBeforeInterval++;
                }
            }
        });
    }

    // Count the number of canceled subscriptions during the interval
    if(intervalSubscriptions && intervalSubscriptions){
        collections.forEach(intervalSubscriptions, function (subscription) {
            if (
            subscription.custom &&
            !subscription.custom.isActive &&
            subscription.custom.lastCanceled >= startDate &&
            subscription.custom.lastCanceled <= endDate
            ) {
                if (!productId || subscription.custom.productId == productId) {
                    numberOfCanceledSubscriptionsDuringInterval++;
                }
            }
        });
    }

    if (numberOfActiveSubscriptionsBeforeInterval !== 0 && numberOfCanceledSubscriptionsDuringInterval !== 0) {
        churnRate = (numberOfCanceledSubscriptionsDuringInterval / numberOfActiveSubscriptionsBeforeInterval) *100;
    } else if (
        numberOfActiveSubscriptionsBeforeInterval === 0 && numberOfCanceledSubscriptionsDuringInterval !== 0) {
        churnRate = 100;
    }
    return churnRate;
}

/**
 * Calculates the reactivation rate for a given set of subscriptions.
 *
 * @param {dw.util.Collection} intervalSubscriptions - The subscriptions to calculate the reactivation rate for.
 * @param {Date} startDate - The start date of the interval.
 * @param {Date} endDate - The end date of the interval.
 * @param {String} [productId] - The product ID to filter the subscriptions by.
 * @returns {Number} The reactivation rate, as a percentage.
 */
function calculateReactivationRate (intervalSubscriptions, startDate, endDate, productId) {
    var reactivationRate = 0;
    var numberOfReactivatedSubscriptionsDuringInterval = 0;

    if(intervalSubscriptions && intervalSubscriptions.length){
    collections.forEach(intervalSubscriptions, function (subscription) {
        if (subscription.custom && subscription.custom.isActive) {
            var lastActivated = subscription.custom.lastActivated;
            if (lastActivated && lastActivated >= startDate && lastActivated <= endDate) {
                // Check if the product ID is specified, and if so, check if the subscription matches the product ID.
                if (!productId || subscription.custom.productId == productId) {
                    numberOfReactivatedSubscriptionsDuringInterval++;
                }
            }
        }
    });
    }

    if (numberOfCanceledSubscriptionsDuringInterval !== 0 && numberOfReactivatedSubscriptionsDuringInterval !== 0) {
        reactivationRate = (numberOfReactivatedSubscriptionsDuringInterval / numberOfCanceledSubscriptionsDuringInterval) * 100;
    } else if (numberOfCanceledSubscriptionsDuringInterval === 0 && numberOfReactivatedSubscriptionsDuringInterval !== 0) {
        reactivationRate = 100;
    }

    return reactivationRate;
}

/**
 * Calculates the revenue for a given list of subscription orders.
 *
 * @param {dw.util.SeekableIterator} ordersIterator The list of subscription orders.
 * @param {string} [productId] The ID of the product for which to calculate the revenue. If not specified, the revenue for all products will be calculated.
 * @return {number} The total revenue.
 */
function calculateRevenue(ordersIterator, productId) {
    var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
    var revenue = 0;

    while (ordersIterator.hasNext()) {
        var subscriptionOrder = ordersIterator.next();
        var subscribedProductLineItems = subscriptionHelpers.getSubscribedProductLineItems(subscriptionOrder);
        var allProductLineItems = subscriptionOrder.allProductLineItems;
        var shippingTotalGrossPrice = subscriptionOrder.shippingTotalGrossPrice;

        // Calculate the prorated shipping gross price for the subscription order.
        var proRatedShippingTotalGrossPrice = shippingTotalGrossPrice / allProductLineItems.length;

        if (productId) {
            // If the subscription order contains only one subscription product of the specified productId,
            // add the total gross price of the subscription order to the revenue.
            if (subscribedProductLineItems.length == 1 && allProductLineItems.length == 1 && subscribedProductLineItems[0].productID == productId) {
                revenue += subscriptionOrder.totalGrossPrice;
            } else {
                collections.forEach(subscribedProductLineItems, function (pli) {
                    // If the product ID of the product line item matches the productId parameter,
                    // add the gross price of the product line item to the revenue and the prorated shipping gross price.
                    if (pli.productID == productId) {
                        revenue += pli.grossPrice;
                        revenue += proRatedShippingTotalGrossPrice;
                    }
                });
            }
            
        } else {
            // If the subscription order contains only subscription products,
            // add the total gross price of the subscription order to the revenue.
            if (subscribedProductLineItems.length == allProductLineItems.length) {
                revenue += subscriptionOrder.totalGrossPrice;
            }
            // Order contains a mixed products
            else {
                collections.forEach(subscribedProductLineItems, function (pli) {
                    // Add the gross price of the product line item to the revenue and the prorated shipping gross price.
                    revenue += pli.grossPrice;
                    revenue += proRatedShippingTotalGrossPrice;
                });
            }
        }
    }
    return revenue;
}

/**
 * Retrieves the top subscribed products from the given product subscriptions list.
 * @param {dw.util.Collection} productSubscriptions - The list of product subscriptions.
 * @param {number} limit - The maximum number of top products to retrieve.
 * @returns {dw.util.Collection} - The top subscribed products.
 */
function getTopSubscribedProducts(productSubscriptions, limit) {
    var subscribedProducts = new Map();
    var topProducts;
    
    if (productSubscriptions && productSubscriptions.length) {
        collections.forEach(productSubscriptions, function (productSubscription) {
            var productId = productSubscription.custom.productId;
            if (subscribedProducts.has(productId)) {
                subscribedProducts.set(
                    productId,
                    subscribedProducts.get(productId) + 1
                );
            } else {
                subscribedProducts.set(productId, 1);
            }
        });

        // Convert the Map to an array of key-value pairs
        var subscribedProductsArray = Array.from(subscribedProducts);
        // Sort the array based on the values in descending order
        subscribedProductsArray.sort(function (a, b) {
            return b[1] - a[1];
        });

        // Retrieve the top subscribed products up to the specified limit
        topProducts = subscribedProductsArray.slice(0, limit).map(function (pair) {
            return pair[0];
        });
    }
    return topProducts;
}

/**
 * Calculates the number of subscription orders that contain a specific product.
 *
 * @param {dw.util.SeekableIterator} ordersIterator - The collection of subscription orders.
 * @param {string} productId - The ID of the product to search for.
 * @returns {number} - The number of subscription orders containing the specified product.
 */
function calculateNumberOfSubscriptionOrders(ordersIterator, productId) {
    var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
    var numberOfSubscriptionOrders = 0;

    while (ordersIterator.hasNext()) {
        var subscriptionOrder = ordersIterator.next();
        var subscribedProductLineItems = subscriptionHelpers.getSubscribedProductLineItems(subscriptionOrder);
        collections.forEach(subscribedProductLineItems, function (pli) {
            if (pli.productID == productId) {
                numberOfSubscriptionOrders++;
                return;
            }
        });
    }
    return numberOfSubscriptionOrders;
}

/**
 * Calculates the average revenue per user.
 *
 * @param {number} totalRevenue The total revenue generated by all subscribers.
 * @param {number} numberOfSubscribers The number of subscribers.
 * @returns {number} The average revenue per user.
 */
function caculateARPU(totalRevenue, numberOfSubscribers) {
  var averageRevenuePerUser = 0 ;

  if (totalRevenue && numberOfSubscribers) {
    averageRevenuePerUser = totalRevenue / numberOfSubscribers;
  } 
  return averageRevenuePerUser;
}

/**
 * Calculates the average order value for a given number of subscription orders and total revenue.
 *
 * @param {number} totalRevenue The total revenue for all subscription orders.
 * @param {number} numberOfSubscriptionOrders The number of subscription orders.
 * @returns {number} The average order value.
 */
function calculateAOV(totalRevenue, numberOfSubscriptionOrders) {
  var averageOrderValue = 0;

  if (numberOfSubscriptionOrders  && totalRevenue) {
    averageOrderValue = totalRevenue / numberOfSubscriptionOrders;
  } 
  return averageOrderValue;
}

/**
 * Gets the revenue report data for the specified date range.
 *
 * @param {string} startDate The start date of the report.
 * @param {string} endDate The end date of the report.
 * @param {string} productId The ID of the product, if any.
 * @param {object} result The result object.
 * @returns {array} The revenue report data.
 */
function getRevenueReportData(startDate, endDate, productId,result) {
    var CustomObjectMgr = require("dw/object/CustomObjectMgr");
    var OrderMgr = require("dw/order/OrderMgr");
    var Order = require("dw/order/Order");
    var ProductMgr = require('dw/catalog/ProductMgr');
    var ArrayList = require('dw/util/ArrayList');
    var Resource = require("dw/web/Resource");

    var allSubscriptions = new ArrayList();
    var intervalSubscriptions = new ArrayList();

    // Set to the beginning of the day
    var intervalStartDate = new Date(startDate);
    intervalStartDate.setHours(0, 0, 0, 0); 

    // Set to the end of the day
    var intervalEndDate = new Date(endDate);
    intervalEndDate.setHours(23, 59, 59, 999); 
    var intervalQuery;
    var product;

    if (productId) {
    product = ProductMgr.getProduct(productId);
    if (product) {
        var productQuery = "custom.productId={0}";
        intervalQuery = "custom.productId={0} AND creationDate>={1} AND creationDate<={2}";
        allSubscriptions = CustomObjectMgr.queryCustomObjects(
            SUBSCRIPTION_OBJECT_NAME,
            productQuery,
            null,
            productId
        ).asList();
        intervalSubscriptions = CustomObjectMgr.queryCustomObjects(
            SUBSCRIPTION_OBJECT_NAME,
            intervalQuery,
            null,
            productId,
            intervalStartDate,
            intervalEndDate
        ).asList();
    } else {
        result.error = true;
        result.message = Resource.msg("text.alert.invalidProductId", "report", null);
        return;
    }
    } else {
        intervalQuery = "creationDate>={0} AND creationDate<={1}";
        allSubscriptions = CustomObjectMgr.getAllCustomObjects(SUBSCRIPTION_OBJECT_NAME).asList();
        intervalSubscriptions = CustomObjectMgr.queryCustomObjects(
            SUBSCRIPTION_OBJECT_NAME,
            intervalQuery,
            null,
            intervalStartDate,
            intervalEndDate
        ).asList();
    }

    if (!(intervalSubscriptions && intervalSubscriptions.length)) {
        result.error = true;
        result.message = Resource.msg("text.alert.emptySubscriptions", "report", null);
        return;
    }

    var totalSubscriptionsCount = allSubscriptions.length;
    var intervalSubscriptionsCount = intervalSubscriptions.length;

    // Get the subscription orders for the given interval.
    var orderQuery = "creationDate>={0} AND creationDate<={1} AND status!={2} AND status!={3} AND custom.isSubscriptionOrder={4}";
    var ordersIterator = OrderMgr.searchOrders(orderQuery, null, intervalStartDate, intervalEndDate, Order.ORDER_STATUS_CANCELLED, Order.ORDER_STATUS_FAILED, true);

    var totalRevenue = calculateRevenue(ordersIterator, productId);
    var numberOfSubscriptionOrders = productId ? calculateNumberOfSubscriptionOrders(ordersIterator, productId) : (ordersIterator.count >=0 ? ordersIterator.count : 0);
    var topProducts = productId ? [productId] : getTopSubscribedProducts(intervalSubscriptions, TOP_PRODUCTS_LIMIT);  
    var numberOfSubscribers = getSubscribersCount(intervalSubscriptions);
    var churnRate = calculateChurnRate(allSubscriptions, intervalSubscriptions, intervalStartDate, intervalEndDate, productId);
    var reactivationRate = calculateReactivationRate(intervalSubscriptions, intervalStartDate, intervalEndDate, productId);
    var growthRate = calculateGrowthRate(allSubscriptions, intervalSubscriptions, intervalStartDate, intervalEndDate, productId);
    var averageRevenuePerUser = caculateARPU(totalRevenue, numberOfSubscribers);
    var averageOrderValue = calculateAOV(totalRevenue, numberOfSubscriptionOrders);

    var csvData = [
        parseFloat(totalRevenue.toFixed(2)),
        topProducts,
        numberOfSubscribers,
        parseFloat(churnRate.toFixed(2)),
        parseFloat(averageRevenuePerUser.toFixed(2)),
        parseFloat(growthRate.toFixed(2)),
        parseFloat(reactivationRate.toFixed(2)),
        parseFloat(averageOrderValue.toFixed(2)),
    ];
    return csvData;
}

module.exports = {
  getRevenueReportData: getRevenueReportData,
};
