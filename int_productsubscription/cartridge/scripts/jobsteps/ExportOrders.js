function getFileWriter() {
    // fileWriter imports
    var File = require('dw/io/File');
    var FileWriter = require('dw/io/FileWriter');
    var Calendar = require('dw/util/Calendar');
    var StringUtils = require('dw/util/StringUtils');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var cal = new Calendar();
    var stamp = StringUtils.formatCalendar(cal, 'yyyyMMddhhmmss');
    
    // orderExport_stamp.xml creation
    var fileName = ['orderExport_'+stamp+'.xml'].join('');
    var filepath = [File.IMPEX, 'src', 'order'].join(File.SEPARATOR);
    var filepathFile = new File(filepath);
    var file = new File(filepathFile, fileName);
    file.createNewFile();
    var fileWriter = new FileWriter(file);
    var xmlStreamWriter = new XMLStreamWriter(fileWriter);
    return [xmlStreamWriter, fileWriter];
}

/**
 * Orders export
 * This script should be executed as part of Job Schedule and will export the orders item by item as they reach their order date.
 * @param OrdersLimit: Long The given N to limit the number of orders processed
 */
function process() {
    var args = arguments[0];
    var ordersLimit = args.OrdersLimit?args.OrdersLimit:300;

    // Load input Parameters
    var Order = require('dw/order/Order');
    var collections = require('*/cartridge/scripts/util/collections');
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var subscriptionHelpers = require("*/cartridge/scripts/subscription/subscriptionHelpers");
    var ShippingMgr = require('dw/order/ShippingMgr');
    var Logger = require('dw/system/Logger');

    const SUBSCRIPTION_STATUS_NOT_APPLICABLE = 0;
    const SUBSCRIPTION_STATUS_PENDING = 1;
    const SUBSCRIPTION_STATUS_COMPLETE = 2;

    var query = "(status = {0} OR status = {1}) and exportStatus = {2}";
    var orders = OrderMgr.searchOrders(query, 'orderNo DESC', Order.ORDER_STATUS_NEW, Order.ORDER_STATUS_OPEN, Order.EXPORT_STATUS_READY).asList();

    if(orders && orders.length > 0) {
        var [xsw, fileWriter] = getFileWriter();
        xsw.writeStartDocument();
        xsw.writeStartElement("orders");
        xsw.writeDefaultNamespace("http://www.demandware.com/xml/impex/order/2006-10-31");
        for(let orderIndex = 0; orderIndex < orders.length && orderIndex < ordersLimit; orderIndex++) {
            var isAlreadyExported = false;
            var slisToRemove;
            try {
                Transaction.begin();
                var order = orders[orderIndex];

                var productLineItems = order.productLineItems;
                var plisLength = order.productLineItems.size();
                var plisToRemove = [];
                var plisToRemoveCustomAttributes = [];
                var exportCount = 0;
                
                // to check if shipping needs to be zeroed
                var plis = productLineItems.iterator();
                var pli;    
                while(plis.hasNext()) {
                    pli = plis.next();
                    if(pli.custom.exportStatus) {
                        isAlreadyExported = true;
                        slisToRemove = order.defaultShipment.shippingLineItems;
                        collections.forEach(slisToRemove, function(sliToRemove) {
                            order.defaultShipment.removeShippingLineItem(sliToRemove);
                        });
                        break;
                    }
                }

                collections.forEach(productLineItems, function(pli) {
                    if(!pli.custom.exportStatus && pli.custom.subscriptionStatus.value !== SUBSCRIPTION_STATUS_PENDING) {
                        pli.custom.exportStatus = true;
                        exportCount++;
                    } else {
                        if(pli.custom.exportStatus) {
                            exportCount++;
                        }
                        plisToRemoveCustomAttributes.push(
                            {
                                subscriptionStatus : pli.custom.subscriptionStatus,
                                subscriptionItem : pli.custom.subscriptionItem,
                                subscriptionInterval : pli.custom.subscriptionInterval,
                                subscriptionID : pli.custom.subscriptionID,
                                selectedOrderDate : pli.custom.selectedOrderDate,
                                subscribed: pli.custom.subscribed,
                            }
                        );
                        plisToRemove.push(pli);
                        order.removeProductLineItem(pli);
                    }
                });
                order.updateTotals();
                if(exportCount === productLineItems.length) {
                    order.setExportStatus(Order.EXPORT_STATUS_EXPORTED);
                }
                Transaction.commit();
            } catch(e) {
                Logger.error("Error while removing line items" + e);
                Transaction.rollback();
            }
            
            // XML Writing
            if(plisLength !== plisToRemove.length) {
                var orderXMLAsString = order.getOrderExportXML();
                var orderXMLLines = orderXMLAsString.split("\n");
                xsw.writeStartElement("order");
                xsw.writeAttribute("order-no", order.orderNo);
                fileWriter.writeLine(">");
                for(let lineNumber=2; lineNumber < orderXMLLines.length - 2; lineNumber++) {
                    fileWriter.writeLine(orderXMLLines[lineNumber]);
                }
                xsw.writeEndElement();        
            }

            // adding back the line items
            try{
                Transaction.begin();
                var index = 0;
                for(let pliToRemove of plisToRemove) {
                    var pli = order.createProductLineItem(pliToRemove.productID, order.defaultShipment);

                    pli.setQuantityValue(parseInt(pliToRemove.quantityValue));
                    if(pliToRemove.product && pliToRemove.product.priceModel) {
                        pli.setPriceValue(pliToRemove.product.priceModel.price.value);
                    }
                    pli.setPosition(pliToRemove.getPosition());
                    pli.custom.subscriptionStatus = plisToRemoveCustomAttributes[index].subscriptionStatus.value;
                    if(plisToRemoveCustomAttributes[index].subscriptionItem) {
                        var subscriptionPrice = subscriptionHelpers.getSubscriptionPrice(pliToRemove.product);
                        pli.setPriceValue(parseFloat(subscriptionPrice));
                        pli.custom.subscriptionItem = plisToRemoveCustomAttributes[index].subscriptionItem;
                        pli.custom.subscriptionID = plisToRemoveCustomAttributes[index].subscriptionID;
                        pli.custom.subscriptionInterval	= plisToRemoveCustomAttributes[index].subscriptionInterval;
                        pli.custom.selectedOrderDate = plisToRemoveCustomAttributes[index].selectedOrderDate;
                    }
                    pli.updateTax(pliToRemove.taxRate);
                    index++;
                }
                order.updateTotals();
                Transaction.commit();
            } catch(e) {
                Logger.error("Error while adding back the product line items" + e);
                Transaction.rollback();
            }
                
            // reapplying shipment if it was zeroed
            if(isAlreadyExported) {
                try {
                    Transaction.begin();
                    collections.forEach(slisToRemove, function(sliToRemove) {
                        var sli = order.defaultShipment.createShippingLineItem(sliToRemove.ID);
                        sli.setTaxRate(sliToRemove.taxRate);
                    });
                    ShippingMgr.applyShippingCost(order);
                    collections.forEach(order.defaultShipment.shippingLineItems, function(sli) {
                        sli.updateTax(sli.taxRate);
                    });
                    order.updateTotals();
                    Transaction.commit();
                } catch(e) {
                    Logger.error("Error while adding back shipping line items" + e);
                    Transaction.rollback();
                }
            }
        }
        xsw.writeEndElement();
        xsw.writeEndDocument();
        xsw.flush();
        xsw.close();
        fileWriter.flush();
        fileWriter.close();
    } else {
        Logger.info("No orders found to export");
    }
}

exports.process = process;
