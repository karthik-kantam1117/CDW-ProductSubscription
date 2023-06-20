(function ($) {
    $.noConflict();

    /**
     * Creates a notification message.
     * @param {string} messageType - The type of the message (e.g., 'alert-success', 'alert-danger').
     * @param {string} message - The content of the message.
     */
    function createNotification(messageType, message) {
        var $messageWrapper = $('.add-to-cart-messages');
        if ($messageWrapper.length === 0) {
            $('body').append('<div class="add-to-cart-messages"></div>');
            $messageWrapper = $('.add-to-cart-messages');
        } else {
            $messageWrapper.html('');
        }

        $messageWrapper.append(
            '<div class="alert ' + messageType + ' add-to-basket-alert text-center" role="alert">'
            + message
            + '<button class="closeX btn"><span aria-hidden="true">×</span></button>'
            + '</div>'
        );

        $messageWrapper.find('.closeX').on('click', function () {
            $('.add-to-basket-alert').remove();
        });
        setTimeout(function () {
            $('.add-to-basket-alert').remove();
        }, 5000);
    }

    /**
     * Appends parameters to a URL.
     * @param {string} url - The URL to append the parameters to.
     * @param {Object} params - The parameters to append.
     * @returns {string} The new URL with the appended parameters.
     */
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

    $("body").on("click", "#download-report-btn", function (event) {
        event.preventDefault();
        var pid = $('#productID').val();
        // Removing leading and trailing whitespaces 
        var productID = pid.trim();
        var selectedStartDate = $('#startDate').val();
        var selectedEndDate = $('#endDate').val();
        if (!selectedStartDate || !selectedEndDate) {
            
            if (!selectedStartDate) {
                alert('Please select a start date');
            } else {
                alert('Please select an end date');
            }
            return;
        } else if (selectedStartDate > selectedEndDate) {
            alert('Please select a valid start date and end date');
            return;
        } 
        var url = $(this).data('action');
        var urlParams = {
            startDate: selectedStartDate,
            endDate: selectedEndDate,
            productID: productID,
        };
        url = appendToUrl(url, urlParams);
        $.ajax({
            url: url,
            type: "post",
            dataType: "json",
            success: function (data) {
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                }
                createNotification('alert-success', data.message);
            },
            error: function (err) {
                createNotification('alert-danger', err.responseJSON.message);
            },
        });
        
    });
})(jQuery);
