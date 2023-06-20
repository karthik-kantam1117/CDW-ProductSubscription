"use strict";

function confirmUpdate(
  actionUrl,
  productID,
  productName,
  subscriptionID,
  udate,
  futureOrdersChecked
) {
  var $updateConfirmBtn = $(".subscription-save-date-confirmation-btn");
  var $productToUpdateSpan = $(".product-to-update");
  $updateConfirmBtn.data("pid", productID);
  $updateConfirmBtn.data("sid", subscriptionID);
  $updateConfirmBtn.data("action", actionUrl);
  $updateConfirmBtn.data("udate", udate);
  $updateConfirmBtn.data("futureOrdersChecked", futureOrdersChecked);

  var checkedNote = "Note: Your future subscription order dates will be changed.";
  var uncheckedNote = "Note: Your future subscription order dates will not be changed.";
  if(futureOrdersChecked) {
    $(".save-date-note").empty().append(checkedNote);
  } else {
    $(".save-date-note").empty().append(uncheckedNote);
  }
  $productToUpdateSpan.empty().append(productName);
}

function confirmDelete(
  actionUrl,
  productID,
  productName,
  subscriptionID
) {
  var $deleteConfirmBtn = $(".subscription-delete-confirmation-btn");
  var $productToRemoveSpan = $(".product-to-remove");

  $deleteConfirmBtn.data("pid", productID);
  $deleteConfirmBtn.data("sid", subscriptionID);
  $deleteConfirmBtn.data("action", actionUrl);

  $productToRemoveSpan.empty().append(productName);
}

function appendToUrl(url, params) {
  var newUrl = url;
  newUrl +=
    (newUrl.indexOf("?") !== -1 ? "&" : "?") +
    Object.keys(params)
      .map(function (key) {
        return key + "=" + encodeURIComponent(params[key]);
      })
      .join("&");

  return newUrl;
}


function emptyCartDisplay(subscriptionType, data) {
  $(".subscription-container")
          .empty()
          .append(
            '<div class="container subscription-container cart-empty"> ' +
              '<div class="row justify-content-center"> ' +
              '<div class="col-8 text-center">' +
              '<h2 class="mb-3 subscription-no-subscription">' +
              "Your have no " + subscriptionType.toLocaleLowerCase() +" subscriptions." +
              "</h2> " +
              "<p>" +
              subscriptionType + " subscriptions will appear here." +
              "</p>" +
              '<a class="btn btn-primary btn-block continue-shopping-link" href="' +
              data.homeLink +
              '" title="Continue Shopping">Continue Shopping</a>' +
              "</div>" +
              "</div> " +
              "</div>"
  );
}


function createNotification(messageType, message) {
  // show add to cart toast
  var $messageWrapper=$('.add-to-cart-messages');
  if ($messageWrapper.length === 0) {
      $('body').append(
          '<div class="add-to-cart-messages"></div>'
      );
      $messageWrapper=$('.add-to-cart-messages');
  }
  else {
      $messageWrapper.html('');
  }

  $messageWrapper.append(
      '<div class="alert ' + messageType + ' add-to-basket-alert text-center" role="alert">'
      + message
      + '<button class="closeX btn"><span aria-hidden="true">×</span></button>'
      + '</div>'
  );

  $messageWrapper.find('.closeX').on('click', function(){
      $('.add-to-basket-alert').remove();
  });    
}

$("body").on("click", ".remove-product", function (e) {
  e.preventDefault();

  var actionUrl = $(this).data("action");
  var productID = $(this).data("pid");
  var subscriptionID = $(this).data("sid");
  var productName = $(this).data("name");
  confirmDelete(actionUrl, productID, productName, subscriptionID);
});

$("body").on("click", ".update-product", function (e) {
  e.preventDefault();
  var actionUrl = $(this).data("action");
  var productID = $(this).data("pid");
  var subscriptionID = $(this).data("sid");
  var productName = $(this).data("name");
  var udate = $(this)
    .closest(".product-info")
    .find("#preferredOrderDate")
    .val();
  var futureOrdersChecked = $(this).closest('.product-info').find(".future-orders-group input[type='checkbox']").prop('checked');
  confirmUpdate(actionUrl, productID, productName, subscriptionID, udate, futureOrdersChecked);
});

$("body").on("click", ".subscription-delete-confirmation-btn", function (e) {
  e.preventDefault();
  var subscriptionID = $(this).data("sid");
  var url = $(this).data("action");
  var urlParams = {
    sid: subscriptionID,
  };

  url = appendToUrl(url, urlParams);

  // to remove the backdrop effect in the background when user clicks yes in cancel-modal
  $("body > .modal-backdrop").remove();

  $.spinner().start();

  $.ajax({
    url: url,
    type: "get",
    dataType: "json",
    success: function (data) {
      if ($(".subscription-container .card.product-info").length === 1) {
        emptyCartDisplay("Active", data);

      } else {
        $(".sid-" + subscriptionID).remove();
      }
      $.spinner().stop();
      createNotification('alert-success', data.successMessage);
    },
    error: function (err) {
      createNotification("alert-danger", err.responseJSON.errorMessage);
      $.spinner().stop();
    },
  });
});

$("body").on("click", ".reactivate-subscription-btn", function (e) {
  e.preventDefault();
  var subscriptionID = $(this).data("sid");
  var url = $(this).data("action");
  var quantity = $(this).closest('.product-info').find(".line-item-quantity input[name='quantity']").val();
	var subscriptionInterval = $(this).closest('.product-info').find("#subscriptionInterval").val();

  if(quantity <= 0) {
    createNotification('alert-danger', "Please select a valid quantity.");
    return;
  }
  var urlParams = {
    	sid: subscriptionID,
      orderInterval: subscriptionInterval,
      quantity: quantity,
  };

  url = appendToUrl(url, urlParams);

  $.spinner().start();

  $.ajax({
    url: url,
    type: "get",
    dataType: "json",
    success: function (data) {
      if ($(".subscription-container .card.product-info").length === 1) {
        emptyCartDisplay("Canceled", data);
      } else {
        $(".sid-" + subscriptionID).remove();
      }
      $.spinner().stop();
      createNotification('alert-success', data.successMessage);
    },
    error: function (err) {
      createNotification('alert-danger', err.responseJSON.errorMessage);
      $.spinner().stop();
    },
  });
});


$("body").on("click", ".update-subscription-btn", function (e) {
  e.preventDefault();
  var subscriptionID = $(this).data("sid");
  var url = $(this).data("action");

  var quantity = $(this).closest('.product-info').find(".line-item-quantity input[name='quantity']").val();
	var subscriptionInterval = $(this).closest('.product-info').find("#subscriptionInterval").val();

  if(quantity <= 0) {
    createNotification('alert-danger', "Please select a valid quantity.");
    return;
  }
  if(($(this).data("quantity") == quantity && $(this).data("orderinterval") == subscriptionInterval)){
    createNotification('alert-danger', "Kindly update and try again.");
    return;
  }
  
  var urlParams = {
    	sid: subscriptionID,
      orderInterval: subscriptionInterval,
      quantity: quantity
  };

  url = appendToUrl(url, urlParams);

  $.spinner().start();

  $.ajax({
    url: url,
    type: "post",
    dataType: "json",
    success: function (data) {
        $(this).data();
        $.spinner().stop();
        createNotification('alert-success', data.successMessage);
    },
    error: function (err) {
        $.spinner().stop();
      createNotification('alert-danger', err.responseJSON.errorMessage);
    },
  });
});

$("body").on("click", ".subscription-save-date-confirmation-btn", function (e) {
  e.preventDefault();
  var subscriptionID = $(this).data("sid");
  var url = $(this).data("action");
  var udate = $(this).data("udate");
  var futureOrdersChecked = $(this).data("futureOrdersChecked");
  
  var dateToStrFunc = (dateObj) => {
    let dateStr = "";
    dateStr += dateObj.getFullYear() + "-";
    let month = dateObj.getMonth() + 1;
    dateStr += month.toString().padStart(2, "0") + "-";
    dateStr += dateObj.getDate().toString().padStart(2, "0");
    return dateStr;
  };
  if (dateToStrFunc(new Date(udate)) <= dateToStrFunc(new Date())) {
    createNotification(
      "alert-danger",
      "Can't change the next occurence date if it's today or before."
    );
    return;
  }

  var urlParams = {
    	sid: subscriptionID,
      futureOrdersChecked: futureOrdersChecked,
      udate: udate,
  };
  url = appendToUrl(url, urlParams);

  $.spinner().start();

  $.ajax({
    url: url,
    type: "post",
    dataType: "json",
    success: function (data) {
        $(`.subscription-container`).empty().append(data.subscriptionProductsContainerHtml);
        createNotification('alert-success', data.successMessage);
        $.spinner().stop();
    },
    error: function (err) {
        createNotification('alert-danger', err.responseJSON.errorMessage);
        $.spinner().stop();
    },
  });
});


$('body').on('click', '.upcomingdeliveries-subscription-tab', function(event) {
  toggleTabTo('upcomingdeliveries', this);
});

$('body').on('click', '.cancel-subscription-tab', function(event) {
  toggleTabTo('cancel', this);
});


$('body').on('click', '.active-subscription-tab', function(event) {
  toggleTabTo('active', this);
});

function toggleTabTo(subscriptionType, currentBtnObj) {
  $(`.${subscriptionType}-subscription-tab`).addClass('subscription-tab-on');
  $(`.subscription-tab`).not(`.${subscriptionType}-subscription-tab`).removeClass('subscription-tab-on');

  
  var url = $(currentBtnObj).data("action");
  var urlParams = {
    subscriptionType: subscriptionType
  };
  url = appendToUrl(url, urlParams);

  $.spinner().start();

  $.ajax({
    url: url,
    type: "get",
    dataType: "json",
    success: function (data) {
      $(`.subscription-container`).empty().append(data.subscriptionProductsContainerHtml);
      $('[data-toggle="tooltip"]').tooltip();
      $.spinner().stop();
    },
    error: function (err) {
      createNotification('alert-danger', err.responseJSON.errorMessage);
      $.spinner().stop();
    },
  });
}

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})



/**
 * Updates the Mini-Cart quantity value after the customer has pressed the "Add to Cart" button
 * @param {string} response - ajax response from clicking the add to cart button
 */
 function handlePostCartAdd(response) {
  $('.minicart').trigger('count:update', response);
  var messageType = response.error ? 'alert-danger' : 'alert-success';

  if ($('.add-to-cart-messages').length === 0) {
      $('body').append(
          '<div class="add-to-cart-messages"></div>'
      );
  }

  $('.add-to-cart-messages').append(
      '<div class="alert ' + messageType + ' add-to-basket-alert text-center" role="alert">'
      + response.message
      + '</div>'
  );

  setTimeout(function () {
      $('.add-to-basket-alert').remove();
  }, 5000);
}
/**
 * appends params to a url
 * @param {string} data - data returned from the server's ajax call
 * @param {Object} button - button that was clicked to add a product to the wishlist
 */
 function displayMessage(data, button) {
  $.spinner().stop();
  var status;
  if (data.success) {
      status = 'alert-success';
  } else {
      status = 'alert-danger';
  }

  if ($('.add-to-cart-messages').length === 0) {
      $('body').append(
      '<div class="add-to-cart-messages "></div>'
      );
  }
  $('.add-to-cart-messages')
      .append('<div class="alert add-to-basket-alert text-center ' + status + '">' + data.msg + '</div>');

  setTimeout(function () {
      $('.add-to-cart-messages').remove();
      button.removeAttr('disabled');
  }, 5000);
}



  $("body").on("click", ".need-this-sooner",function (e) {
    e.preventDefault();
    var url = $(this).data("action");
    var pid = $(this).data("pid");
    if (!url || !pid) {
      return;
    }
    var form = {
      pid: pid,
      quantity: 1,
      options:[],
    };
    $.spinner().start();
    $(this).attr("disabled", true);
    $.ajax({
      url: url,
      type: "post",
      dataType: "json",
      data: form,
      success: function (data) {
        handlePostCartAdd(data);
        $('body').trigger('product:afterAddToCart', data);
        $.spinner().stop();
      },
      error: function (err) {
        $.spinner().stop();
      },
    });
  });

