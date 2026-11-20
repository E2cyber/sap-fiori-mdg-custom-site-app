sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/ui/Device"
], function (JSONModel, Device) {
  "use strict";

  return {

    createResourceModel: function () {
      return new sap.ui.model.resource.ResourceModel({
        bundleName: "zmdg.site.fiori.i18n.i18n"
      });
    },

    createDeviceModel: function () {
      var oModel = new JSONModel(Device);
      oModel.setDefaultBindingMode("OneWay");
      return oModel;
    }
  };
});
