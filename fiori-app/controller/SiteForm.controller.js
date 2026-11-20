sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
  "use strict";

  const DRAFT_KEY = "mdg_site_drafts";
  const PENDING_CR_KEY = "mdg_site_pending_crs";

  return Controller.extend("zmdg.site.fiori.controller.SiteForm", {

    onInit: function () {
      const oSiteModel = new JSONModel({
        mode: "create",
        isNewDraft: true,
        SiteId: "",
        Name: "",
        City: "",
        Country: "",
        Street: "",
        Zip: "",
        Descr: ""
      });
      this.getView().setModel(oSiteModel, "site");

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("create").attachPatternMatched(this._onCreateMatched, this);
      oRouter.getRoute("edit").attachPatternMatched(this._onEditMatched, this);
      oRouter.getRoute("display").attachPatternMatched(this._onDisplayMatched, this);
    },

    _getResourceBundle: function () {
      return this.getView().getModel("i18n").getResourceBundle();
    },

    _showMessage: function (sMessageKey) {
      const sText = this._getResourceBundle().getText(sMessageKey);
      MessageToast.show(sText);
    },

    _getDrafts: function () {
      try {
        return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]");
      } catch (e) { return []; }
    },

    _saveDrafts: function (aDrafts) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(aDrafts));
      } catch (e) {
        // ignore
      }
    },

    _addPendingCR: function (oPayload, sAction) {
      try {
        const aPending = JSON.parse(localStorage.getItem(PENDING_CR_KEY) || "[]").filter(function (c) {
          return c.SiteId !== oPayload.SiteId;
        });
        aPending.unshift({
          SiteId: oPayload.SiteId,
          Name: oPayload.Name,
          City: oPayload.City,
          Country: oPayload.Country,
          Street: oPayload.Street,
          Zip: oPayload.Zip,
          Descr: oPayload.Descr,
          Action: sAction,
          SubmittedAt: new Date().toLocaleString()
        });
        localStorage.setItem(PENDING_CR_KEY, JSON.stringify(aPending));
      } catch (e) {
        // ignore
      }
    },

    _clearValidationStates: function () {
      const oView = this.getView();
      ["siteId", "name", "city", "country", "street", "zip"].forEach(function (sFieldId) {
        const oField = oView.byId(sFieldId);
        if (oField) {
          oField.setValueState("None");
          oField.setValueStateText("");
        }
      });
    },

    _validateForm: function () {
      const oSiteModel = this.getView().getModel("site");
      const oData = oSiteModel.getData();
      const aErrors = [];
      const oView = this.getView();

      this._clearValidationStates();

      if (!oData.SiteId || !oData.SiteId.trim()) { aErrors.push("siteId"); }
      if (!oData.Name || !oData.Name.trim()) { aErrors.push("name"); }
      if (!oData.City || !oData.City.trim()) { aErrors.push("city"); }
      if (!oData.Country || !oData.Country.trim()) { aErrors.push("country"); }

      aErrors.forEach(function (sFieldId) {
        const oField = oView.byId(sFieldId);
        if (oField) {
          oField.setValueState("Error");
          oField.setValueStateText("This field is required for MDG governance.");
        }
      });

      return aErrors.length === 0;
    },

    _onCreateMatched: function () {
      this._clearValidationStates();
      this._bindNewSite();
    },

    _onEditMatched: function (oEvent) {
      this._clearValidationStates();
      const sSiteId = oEvent.getParameter("arguments").siteId;
      this._bindEditSite(sSiteId);
      this._loadSite(sSiteId, true);
    },

    _onDisplayMatched: function (oEvent) {
      this._clearValidationStates();
      const sSiteId = oEvent.getParameter("arguments").siteId;
      this._setMode("display");
      this._loadSite(sSiteId, false);
    },

    onSwitchToEditPress: function () {
      const sSiteId = this.getView().getModel("site").getProperty("/SiteId");
      if (sSiteId) {
        this.getOwnerComponent().getRouter().navTo("edit", { siteId: sSiteId });
      }
    },

    _setMode: function (sMode) {
      const oView = this.getView();
      let oSiteModel = oView.getModel("site");
      if (!oSiteModel) {
        oSiteModel = new JSONModel({
          mode: sMode,
          isNewDraft: sMode === "create",
          SiteId: "", Name: "", City: "", Country: "", Street: "", Zip: "", Descr: ""
        });
        oView.setModel(oSiteModel, "site");
      } else {
        oSiteModel.setProperty("/mode", sMode);
      }
    },

    _bindNewSite: function () {
      const oView = this.getView();
      const oSiteModel = oView.getModel("site");
      oSiteModel.setData({
        mode: "create",
        isNewDraft: true,
        SiteId: "",
        Name: "",
        City: "",
        Country: "",
        Street: "",
        Zip: "",
        Descr: ""
      });
    },

    _bindEditSite: function (sSiteId) {
      const oView = this.getView();
      const oSiteModel = oView.getModel("site");
      oSiteModel.setData({
        mode: "edit",
        isNewDraft: false,
        SiteId: sSiteId,
        Name: "",
        City: "",
        Country: "",
        Street: "",
        Zip: "",
        Descr: ""
      });
    },

    _loadSite: function (sSiteId, bEditable) {
      const oView = this.getView();
      const oModel = oView.getModel();
      const oSiteModel = oView.getModel("site");
      oView.setBusy(true);

      const aDrafts = this._getDrafts();
      const oDraft = aDrafts.find(function (d) { return d.SiteId === sSiteId; });

      if (oDraft) {
        oView.setBusy(false);
        oSiteModel.setData({
          mode: bEditable ? "edit" : "display",
          isNewDraft: !!oDraft.isNewDraft,
          SiteId: oDraft.SiteId || "",
          Name: oDraft.Name || "",
          City: oDraft.City || "",
          Country: oDraft.Country || "",
          Street: oDraft.Street || "",
          Zip: oDraft.Zip || "",
          Descr: oDraft.Descr || ""
        });
        return;
      }

      oModel.read("/SiteSet('" + sSiteId + "')", {
        success: function (oData) {
          oView.setBusy(false);
          oSiteModel.setData({
            mode: bEditable ? "edit" : "display",
            isNewDraft: false,
            SiteId: oData.ZsiteId || "",
            Name: oData.AdName1 || "",
            City: oData.AdCity1 || "",
            Country: oData.Land1 || "",
            Street: oData.AdStreet || "",
            Zip: oData.AdPstcd1 || "",
            Descr: oData.AdRemark1 || ""
          });
        },
        error: function () {
          oView.setBusy(false);
          MessageBox.error("Failed to load Site " + sSiteId);
        }
      });
    },

    onNavBack: function () {
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.navTo("home");
    },

    _getPayload: function () {
      const oData = this.getView().getModel("site").getData();
      return {
        SiteId: (oData.SiteId || "").trim().toUpperCase(),
        Name: (oData.Name || "").trim(),
        City: (oData.City || "").trim(),
        Country: (oData.Country || "").trim().toUpperCase(),
        Street: (oData.Street || "").trim(),
        Zip: (oData.Zip || "").trim(),
        Descr: (oData.Descr || "").trim()
      };
    },

    _getODataPayload: function () {
      const oPayload = this._getPayload();
      return {
        ZsiteId: oPayload.SiteId,
        AdName1: oPayload.Name,
        AdCity1: oPayload.City,
        Land1: oPayload.Country,
        AdStreet: oPayload.Street,
        AdPstcd1: oPayload.Zip,
        AdRemark1: oPayload.Descr
      };
    },

    onSavePress: function () {
      if (!this._validateForm()) {
        MessageBox.warning(this._getResourceBundle().getText("fillMandatoryFields"));
        return;
      }

      const oView = this.getView();
      const oPayload = this._getPayload();
      const oSiteModel = oView.getModel("site");
      const sMode = oSiteModel.getProperty("/mode");
      const bIsNewDraft = oSiteModel.getProperty("/isNewDraft");

      const aDrafts = this._getDrafts();
      const existingIdx = aDrafts.findIndex(function (d) { return d.SiteId === oPayload.SiteId; });
      const oDraft = {
        SiteId: oPayload.SiteId,
        Name: oPayload.Name,
        City: oPayload.City,
        Country: oPayload.Country,
        Street: oPayload.Street,
        Zip: oPayload.Zip,
        Descr: oPayload.Descr,
        isNewDraft: sMode === "create" ? true : !!bIsNewDraft,
        Status: "Draft",
        UpdatedAt: new Date().toLocaleDateString()
      };

      if (existingIdx >= 0) {
        aDrafts[existingIdx] = oDraft;
      } else {
        aDrafts.unshift(oDraft);
      }

      this._saveDrafts(aDrafts);

      if (sMode === "edit") {
        this._showMessage("draftSaved");
      } else {
        this._showMessage("draftCreated");
      }

      this.getOwnerComponent().getRouter().navTo("home");
    },

    onSubmitPress: function () {
      if (!this._validateForm()) {
        MessageBox.warning(this._getResourceBundle().getText("fillMandatoryFields"));
        return;
      }

      const oView = this.getView();
      const oSiteModel = oView.getModel("site");
      const oPayload = this._getPayload();
      const oODataPayload = this._getODataPayload();
      const sMode = oSiteModel.getProperty("/mode");
      const bIsNewDraft = oSiteModel.getProperty("/isNewDraft");

      MessageBox.confirm(this._getResourceBundle().getText("confirmSubmit"), {
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            oView.setBusy(true);
            const oModel = oView.getModel();
            const sCrAction = (sMode === "edit" && !bIsNewDraft) ? "Update" : "Create";

            const fnSuccess = function () {
              oView.setBusy(false);
              const aRemaining = this._getDrafts().filter(function (d) { return d.SiteId !== oPayload.SiteId; });
              this._saveDrafts(aRemaining);
              this._addPendingCR(oPayload, sCrAction);
              oModel.refresh();
              this._showMessage("siteSubmitted");
              this.getOwnerComponent().getRouter().navTo("home");
            }.bind(this);

            const fnError = function (oError) {
              oView.setBusy(false);
              const sMsg = this._extractErrorMessage(oError, "saveError", oPayload.SiteId);
              MessageBox.warning(sMsg, {
                title: "MDG Governance Queue Notice"
              });
            }.bind(this);

            if (sMode === "edit" && !bIsNewDraft) {
              oModel.update("/SiteSet('" + oODataPayload.ZsiteId + "')", oODataPayload, {
                success: fnSuccess,
                error: fnError
              });
            } else {
              oModel.create("/SiteSet", oODataPayload, {
                success: fnSuccess,
                error: fnError
              });
            }
          }
        }.bind(this)
      });
    },

    _extractErrorMessage: function (oError, sDefaultKey, sSiteId) {
      const oBundle = this._getResourceBundle();
      let sMsg = oBundle.getText(sDefaultKey);
      try {
        const oErr = JSON.parse(oError.responseText);
        if (oErr.error && oErr.error.message && oErr.error.message.value) {
          sMsg = oErr.error.message.value;
        }
      } catch (e) {
        // ignore parse errors
      }
      if (sMsg.indexOf("ENQUEUE_ENTITY") >= 0 || sMsg.indexOf("WRITE_ENTITY") >= 0 || sMsg.indexOf("already in an open") >= 0) {
        return "Site '" + (sSiteId || "") + "' is already in the SAP MDG Change Request queue awaiting approval.\n\nPlease approve or reject the existing Change Request in MDG before submitting another change for this Site.";
      }
      return sMsg;
    }

  });
});