"use strict";
var base = require("base/product/base");
var detail = require("base/product/detail");

/**
 * Retrieves url to use when adding a product to the cart
 *
 * @return {string} - The provided URL to use when adding a product to the cart
 */
function getAddToCartUrl() {
  return $(".add-to-cart-url").val();
}

/**
 * Retrieves the bundle product item ID's for the Controller to replace bundle master product
 * items with their selected variants
 *
 * @return {string[]} - List of selected bundle product item ID's
 */
function getChildProducts() {
  var childProducts = [];
  $(".bundle-item").each(function () {
    childProducts.push({
      pid: $(this).find(".product-id").text(),
      quantity: parseInt($(this).find("label.quantity").data("quantity"), 10),
    });
  });

  return childProducts.length ? JSON.stringify(childProducts) : [];
}

/**
 * Retrieve product options
 *
 * @param {jQuery} $productContainer - DOM element for current product
 * @return {string} - Product options and their selected values
 */
function getOptions($productContainer) {
  var options = $productContainer
    .find(".product-option")
    .map(function () {
      var $elOption = $(this).find(".options-select");
      var urlValue = $elOption.val();
      var selectedValueId = $elOption
        .find('option[value="' + urlValue + '"]')
        .data("value-id");
      return {
        optionId: $(this).data("option-id"),
        selectedValueId: selectedValueId,
      };
    })
    .toArray();

  return JSON.stringify(options);
}

/**
 * Updates the Mini-Cart quantity value after the customer has pressed the "Add to Cart" button
 * @param {string} response - ajax response from clicking the add to cart button
 */
function handlePostCartAdd(response) {
  $(".minicart").trigger("count:update", response);
  var messageType = response.error ? "alert-danger" : "alert-success";
  // show add to cart toast
  if (
    response.newBonusDiscountLineItem &&
    Object.keys(response.newBonusDiscountLineItem).length !== 0
  ) {
    chooseBonusProducts(response.newBonusDiscountLineItem);
  } else {
    if ($(".add-to-cart-messages").length === 0) {
      $("body").append('<div class="add-to-cart-messages"></div>');
    }

    $(".add-to-cart-messages").append(
      '<div class="alert ' +
        messageType +
        ' add-to-basket-alert text-center" role="alert">' +
        response.message +
        "</div>"
    );

    setTimeout(function () {
      $(".add-to-basket-alert").remove();
    }, 5000);
  }
}

function addToCart() {
  $(document).on(
    "click",
    "button.add-to-cart, button.add-to-cart-global",
    function () {
      var addToCartUrl;
      var pid;
      var pidsObj;
      var setPids;

      $("body").trigger("product:beforeAddToCart", this);

      if ($(".set-items").length && $(this).hasClass("add-to-cart-global")) {
        setPids = [];

        $(".product-detail").each(function () {
          if (!$(this).hasClass("product-set-detail")) {
            setPids.push({
              pid: $(this).find(".product-id").text(),
              qty: $(this).find(".quantity-select").val(),
              options: getOptions($(this)),
            });
          }
        });
        pidsObj = JSON.stringify(setPids);
      }

      pid = base.getPidValue($(this));

      var $productContainer = $(this).closest(".product-detail");
      if (!$productContainer.length) {
        $productContainer = $(this)
          .closest(".quick-view-dialog")
          .find(".product-detail");
      }
      addToCartUrl = getAddToCartUrl();
      var isSubscribeProduct = "false";
      var subscriptionInterval = "";
      var selectedOrderDate = "";
      if (
        $("#subscribeProduct") &&
        $("#subscribeProduct").prop("checked") === true
      ) {
        isSubscribeProduct = "true";
        if ($("#subscriptionInterval")) {
          subscriptionInterval = $("#subscriptionInterval").val();
        }
        if($("#preferredOrderDatePDP")) {
          selectedOrderDate = $("#preferredOrderDatePDP").val();
        }
      }

      var form = {
        pid: pid,
        pidsObj: pidsObj,
        childProducts: getChildProducts(),
        quantity: base.getQuantitySelected($(this)),
        isSubscribeProduct: isSubscribeProduct,
        subscriptionInterval: subscriptionInterval,
        selectedOrderDate: selectedOrderDate
      };

      if (!$(".bundle-item").length) {
        form.options = getOptions($productContainer);
      }

      $(this).trigger("updateAddToCartFormData", form);
      if (addToCartUrl) {
        $.ajax({
          url: addToCartUrl,
          method: "POST",
          data: form,
          success: function (data) {
            handlePostCartAdd(data);
            $("body").trigger("product:afterAddToCart", data);
            $.spinner().stop();
            base.miniCartReportingUrl(data.reportingURL);
          },
          error: function () {
            $.spinner().stop();
          },
        });
      }
    }
  );
}

detail.addToCart = addToCart;
var exportDetails = $.extend({}, detail);

module.exports = exportDetails;
