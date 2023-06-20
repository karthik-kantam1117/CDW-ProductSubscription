"use strict";
module.exports = function () {

  function getNextPreferredOrderDate(orderInterval, preferredDate, orderDate) {
    var nextOrderDate = new Date(orderDate.getFullYear(), orderDate.getMonth()+orderInterval, 1);
    var lastOrderDate = new Date(nextOrderDate.getFullYear(), nextOrderDate.getMonth()+1, 0).getDate();
    nextOrderDate.setDate(preferredDate>lastOrderDate?lastOrderDate:preferredDate);
    return nextOrderDate;
  }

  function setNextOrderDate() {
    const dateToStrFunc = (dateObj) => {
      let dateStr = "";
      dateStr += dateObj.getFullYear() + "-";
      let month = dateObj.getMonth() + 1;
      dateStr += month.toString().padStart(2, "0") + "-";
      dateStr += dateObj.getDate().toString().padStart(2, "0");
      return dateStr;
    };
    const currentDate = new Date();
    const currentDateString = dateToStrFunc(currentDate);
    const orderInterval = parseInt(
      $(`.product-subscription-interval select`).val()
    );
    let max = getNextPreferredOrderDate(orderInterval, currentDate.getDate(), currentDate);
    max.setDate(max.getDate()-1);
    max = dateToStrFunc(max);
    $(`.preferredOrderDatePDP input[type="date"]`).attr({
      'min': currentDateString,
      'max': max,
      'value': currentDateString,
    });
  }
  $( document ).ready(function() {
    if($(`.preferredOrderDatePDP input[type="date"]`).length)
      setNextOrderDate();
  });
  $('body').on('change', '.product-subscription-interval .custom-select', function(event) {
    if($(`.preferredOrderDatePDP input[type="date"]`).length)
      setNextOrderDate()
  });
  $("body").on("product:afterAttributeSelect", function (e, response) {
    // Adding the subscription wrapper
    response.container
      .find(".subscription-wrapper")
      .empty()
      .html(response.data.product.subscriptionHtml);
  });
};


