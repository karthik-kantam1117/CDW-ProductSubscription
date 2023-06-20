'use strict';

/**
 * Creates a file name based on the specified prefix, site ID, and locale.
 *
 * @param {String} fileNamePrefix - The prefix for the file name.
 * @param {String} fileExtension - The extension for the file name.
 * @returns {String} The file name.
 */
function createFileName(fileNamePrefix, fileExtension) {
    var Site = require('dw/system/Site');
    var siteID = Site.getCurrent().getID();
    var locale = request.getLocale(); 
    if (!fileExtension) {
        fileExtension = 'csv'; 
    }
    return fileNamePrefix + '_' + siteID + '_' + locale + '.' + fileExtension;
}

/**
 * Creates a subscription revenue report.
 *
 * @param {String} fileName - The name of the file to create the report in.
 * @param {String} targetFolder - The target folder to create the report in.
 * @param {Date} startDate - The start date of the report.
 * @param {Date} endDate - The end date of the report.
 * @param {String} productId - The ID of the product to generate the report for.
 * @returns {Object} An object with the following properties:
 *   * error - A boolean value indicating whether an error occurred.
 *   * message - A string message with more information about the error, if it occurred.
 */
function createSubscriptionRevenueReport (fileName, targetFolder, startDate, endDate, productId) {
    var CSVStreamWriter = require('dw/io/CSVStreamWriter');
    var FileWriter = require('dw/io/FileWriter');
    var File = require('dw/io/File');
    var Logger = require('dw/system/Logger');
    var csvExportHelper = require('*/cartridge/scripts/csvDataHelper.js');
    var Resource = require("dw/web/Resource");
    var folderFile = new File(File.getRootDirectory(File.TEMP), targetFolder);
    var result = {
        error:false,
        message : Resource.msg("text.alert.reportDownloaded", "report", null)
    }
    try {
        if (!folderFile.exists() && !folderFile.mkdirs()) {
            Logger.info('Cannot create TEMP folders {0}', (File.getRootDirectory(File.TEMP).fullPath + targetFolder));
            throw new Error('Cannot create TEMP folders.');
        }
        var csvFile = new File(folderFile.fullPath + File.SEPARATOR + fileName);
        var fileWriter = new FileWriter(csvFile);
        var csvWriter = new CSVStreamWriter(fileWriter);

        var headerColumn = [
            'Total Revenue',
            'Top Products',
            'Number of subscribers',
            'Churn rate',
            'Average revenue per user (ARPU)',
            'Subscription growth rate',
            'Reactivation rate',
            'Average order value (AOV)'
        ];
        csvWriter.writeNext(headerColumn);
        var revenueData = csvExportHelper.getRevenueReportData(startDate,endDate,productId,result);
        if (!result.error) {
            csvWriter.writeNext(revenueData);
        }
    } catch (error) {
        result.error = true;
        result.message = Resource.msg("text.alert.errorInReportGeneration", "report", null);
        Logger.info('[csvExportHelper.js] createSubscriptionRevenueReport() method crashed on line:{0}. ERROR: {1}', error.lineNumber, error.message);
        Logger.error('[csvExportHelper.js] createSubscriptionRevenueReport() method crashed on line:{0}. ERROR: {1}', error.lineNumber, error.message);
    } finally {
        fileWriter.flush();
        csvWriter.close();
        fileWriter.close();
        return result;
    }

}

module.exports = {
    createFileName:createFileName,
    createSubscriptionRevenueReport:createSubscriptionRevenueReport,
};