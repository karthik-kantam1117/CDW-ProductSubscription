"use strict";

module.exports = function () {
  $("body").on("cart:update", function (e, data) {
    // On the cart and min cart pages, overriding the subscription price over the normal price

    if (data && data.items && data.items.length > 0) {
      data.items.forEach(function (item) {
        if (item.subscriptionRenderedPrice) {
          $(".uuid-" + item.UUID + " .unit-price")
            .empty()
            .append(item.subscriptionRenderedPrice);
          $(".line-item-price-" + item.UUID + " .unit-price")
            .empty()
            .append(item.subscriptionRenderedPrice);
          $(".item-total-" + item.UUID)
            .empty()
            .append(item.priceTotal.renderedPrice);
        }
      });
    }
  });
};
