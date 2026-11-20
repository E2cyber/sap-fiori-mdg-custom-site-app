sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "zmdg/site/fiori/model/models"
], function (UIComponent, Device, models) {
  "use strict";

  return UIComponent.extend("zmdg.site.fiori.Component", {

    metadata: {
      manifest: "json"
    },

    init: function () {
      // call the base component's init function
      UIComponent.prototype.init.apply(this, arguments);

      // set the device model BEFORE router initialization
      this.setModel(models.createDeviceModel(), "device");

      // enable routing
      this.getRouter().initialize();
    },

    destroy: function () {
      UIComponent.prototype.destroy.apply(this, arguments);
    },

    getContentDensityClass: function () {
      return Device.support.touch ? "sapUiSizeCozy" : "sapUiSizeCompact";
    }
  });
});