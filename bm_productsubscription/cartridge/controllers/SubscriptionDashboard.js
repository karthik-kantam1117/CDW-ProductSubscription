
'use strict';

var server = require('server');
var URLUtils = require('dw/web/URLUtils');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * SubscriptionDashboard-Show: renders the subscription dashboard page, which provides a report on subscriptions.
 *
 * @name SubscriptionDashboard-Show
 * @function
 * @memberof SubscriptionDashboard
 * @param {middleware} - csrfProtection.generateToken
 * @param {object} - req The request object.
 * @param {object} - res The response object.
 * @param {function} - next The next function in the middleware chain.
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.get('Show', csrfProtection.generateToken,function (req, res, next) {
    var breadcrumbs = [
        {
            url: URLUtils.url('SiteNavigationBar-ShowMenuitemOverview', 'CurrentMenuItemId', 'analytics'),
            text: 'Analytics'
        },
        {
            url: URLUtils.url('SubscriptionDashboard-Show'),
            text: 'Subscription Report'
        }
    ];
    var viewData = {
        breadcrumbs: breadcrumbs,
        downloadReportUrl : URLUtils.url('SubscriptionDashboard-DownloadCSV').toString(),
    };

    res.render('subscriptionDashboard/subscriptionDashboard', viewData);
    next();
});

/**
 * SubscriptionDashboard-DownloadCSV: Handles the POST request for downloading a CSV file.
 *
 * @name SubscriptionDashBoard-DownloadCSV
 * @function
 * @memberof SubscriptionDashboard
 * @param {middleware} - csrfProtection.validateAjaxRequest - Middleware to validate the CSRF token for AJAX requests.
 * @param {object} - req The request object.
 * @param {object} - res The response object.
 * @param {function} - next The next function in the middleware chain.
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post('DownloadCSV',csrfProtection.validateAjaxRequest,function (req, res, next) {
    var File = require('dw/io/File');
    var csvExportHelper = require('*/cartridge/scripts/csvExportHelper.js');

    var csrf = req.querystring.csrf_token;
    var productId = req.querystring.productID;
    var startDate = req.querystring.startDate;  
    var endDate = req.querystring.endDate; 

    var TARGET_FOLDER = 'subscriptionRevenueReportsCSV';
    var fileName = csvExportHelper.createFileName('subscription-revenue-report', 'csv');
    var subscriptionReportResponse = csvExportHelper.createSubscriptionRevenueReport(fileName, TARGET_FOLDER,startDate,endDate,productId);
    res.json(subscriptionReportResponse);

    if (!subscriptionReportResponse.error) {
        var redirectUrl = URLUtils.url('ViewStudioSetup-DownloadFile',
            'SelectedFile', ('Sites' + File.SEPARATOR + File.getRootDirectory(File.TEMP).fullPath + File.SEPARATOR + TARGET_FOLDER) + File.SEPARATOR + fileName,
            'CurrentFolder', ('Sites' + File.SEPARATOR + File.getRootDirectory(File.TEMP).fullPath + File.SEPARATOR + TARGET_FOLDER),
            'csrf_token', csrf).toString();

        res.json({redirectUrl : redirectUrl });
    } else {
        res.setStatusCode(500);
    }
    next();
});

module.exports = server.exports();