sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  const DRAFT_KEY = "mdg_site_drafts";
  const PENDING_CR_KEY = "mdg_site_pending_crs";

  return Controller.extend("zmdg.site.fiori.controller.SiteList", {

    onInit: function () {
      const oAppModel = new JSONModel({
        searchExpanded: false,
        totalSites: 0,
        draftCount: 0,
        drafts: [],
        pendingCount: 0,
        pendingCRs: []
      });
      this.getView().setModel(oAppModel, "app");
      this._loadLocalQueues();

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("home").attachPatternMatched(this._onHomeMatched, this);

      // Real-time background polling: when there are pending CRs, check backend every 8s
      this._oPollTimer = setInterval(function () {
        const aPending = this._getPendingCRs();
        if (aPending.length > 0) {
          const oTable = this.byId("siteListTable");
          if (oTable && oTable.getBinding("items")) {
            oTable.getBinding("items").refresh(true);
          }
        }
      }.bind(this), 8000);
    },

    onExit: function () {
      if (this._oPollTimer) {
        clearInterval(this._oPollTimer);
      }
    },

    _onHomeMatched: function () {
      this._loadLocalQueues();
      const oTable = this.byId("siteListTable");
      if (oTable && oTable.getBinding("items")) {
        oTable.getBinding("items").refresh(true);
      }
    },

    onTableUpdateFinished: function (oEvent) {
      const iTotal = oEvent.getParameter("total");
      const oAppModel = this.getView().getModel("app");
      oAppModel.setProperty("/totalSites", iTotal || 0);

      // Build map of active records currently in YMDG_SITE
      const aItems = oEvent.getSource().getItems();
      const mActiveSites = {};
      aItems.forEach(function (oItem) {
        const oCtx = oItem.getBindingContext();
        if (oCtx) {
          const oRow = oCtx.getObject();
          if (oRow && oRow.ZsiteId) {
            mActiveSites[oRow.ZsiteId] = oRow;
          }
        }
      });

      // Reconcile pending Create, Update, and Delete CRs in real time!
      const aPending = this._getPendingCRs();
      const aStillPending = aPending.filter(function (oCR) {
        const oActive = mActiveSites[oCR.SiteId];

        if (oCR.Action === "Create") {
          // If the newly created site is now in YMDG_SITE, it was approved!
          return !oActive;
        }
        if (oCR.Action === "Delete") {
          // If the deleted site is no longer in YMDG_SITE, it was approved!
          return !!oActive;
        }
        if (oCR.Action === "Update") {
          if (!oActive) {
            return false;
          }
          // Check if active record in YMDG_SITE now matches the updated values from the CR!
          const bNameMatches = (oActive.AdName1 || "") === (oCR.Name || "");
          const bCityMatches = (oActive.AdCity1 || "") === (oCR.City || "");
          const bCountryMatches = (oActive.Land1 || "") === (oCR.Country || "");
          const bStreetMatches = (oActive.AdStreet || "") === (oCR.Street || "");
          const bZipMatches = (oActive.AdPstcd1 || "") === (oCR.Zip || "");
          const bDescrMatches = (oActive.AdRemark1 || "") === (oCR.Descr || "");

          if (bNameMatches && bCityMatches && bCountryMatches && bStreetMatches && bZipMatches && bDescrMatches) {
            return false; // Approved in MDG and active in YMDG_SITE!
          }
          return true;
        }
        return false;
      });

      if (aStillPending.length !== aPending.length) {
        this._savePendingCRs(aStillPending);
      }
    },

    _getResourceBundle: function () {
      return this.getView().getModel("i18n").getResourceBundle();
    },

    _showMessage: function (sMessageKey) {
      const sText = this._getResourceBundle().getText(sMessageKey);
      MessageToast.show(sText);
    },

    _getPendingCRs: function () {
      try {
        const raw = localStorage.getItem(PENDING_CR_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    _savePendingCRs: function (aPending) {
      try {
        localStorage.setItem(PENDING_CR_KEY, JSON.stringify(aPending));
      } catch (e) {
        // ignore storage errors
      }
      const oAppModel = this.getView().getModel("app");
      if (oAppModel) {
        oAppModel.setProperty("/pendingCRs", aPending);
        oAppModel.setProperty("/pendingCount", aPending.length);
      }
    },

    _loadLocalQueues: function () {
      const oAppModel = this.getView().getModel("app");
      try {
        const rawDrafts = localStorage.getItem(DRAFT_KEY);
        const aDrafts = rawDrafts ? JSON.parse(rawDrafts) : [];
        oAppModel.setProperty("/drafts", aDrafts);
        oAppModel.setProperty("/draftCount", aDrafts.length);
      } catch (e) {
        // ignore
      }
      const aPending = this._getPendingCRs();
      oAppModel.setProperty("/pendingCRs", aPending);
      oAppModel.setProperty("/pendingCount", aPending.length);
    },

    _saveDrafts: function (aDrafts) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(aDrafts));
      } catch (e) {
        // ignore
      }
      const oAppModel = this.getView().getModel("app");
      oAppModel.setProperty("/drafts", aDrafts);
      oAppModel.setProperty("/draftCount", aDrafts.length);
    },

    onToggleSearch: function () {
      const oAppModel = this.getView().getModel("app");
      const bExpanded = oAppModel.getProperty("/searchExpanded");
      oAppModel.setProperty("/searchExpanded", !bExpanded);
    },

    onSearchPress: function () {
      const sSiteId = this.byId("searchSiteId").getValue().trim();
      const sName = this.byId("searchName").getValue().trim();
      const sCity = this.byId("searchCity").getValue().trim();
      const sCountry = this.byId("searchCountry").getValue().trim();

      const aFilters = [];
      if (sSiteId) {
        aFilters.push(new Filter("ZsiteId", FilterOperator.Contains, sSiteId));
      }
      if (sName) {
        aFilters.push(new Filter("AdName1", FilterOperator.Contains, sName));
      }
      if (sCity) {
        aFilters.push(new Filter("AdCity1", FilterOperator.Contains, sCity));
      }
      if (sCountry) {
        aFilters.push(new Filter("Land1", FilterOperator.Contains, sCountry));
      }

      const oTable = this.byId("siteListTable");
      const oBinding = oTable.getBinding("items");
      oBinding.filter(aFilters.length ? new Filter(aFilters, true) : []);
    },

    onClearPress: function () {
      this.byId("searchSiteId").setValue("");
      this.byId("searchName").setValue("");
      this.byId("searchCity").setValue("");
      this.byId("searchCountry").setValue("");
      const oTable = this.byId("siteListTable");
      oTable.getBinding("items").filter([]);
    },

    onCreatePress: function () {
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.navTo("create");
    },

    onSitePress: function (oEvent) {
      const oItem = oEvent.getSource();
      const oContext = oItem.getBindingContext();
      const sSiteId = oContext.getProperty("ZsiteId");
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.navTo("display", { siteId: sSiteId });
    },

    onEditPress: function (oEvent) {
      const oButton = oEvent.getSource();
      const oContext = oButton.getBindingContext();
      const sSiteId = oContext.getProperty("ZsiteId");
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.navTo("edit", { siteId: sSiteId });
    },

    onEditDraftPress: function (oEvent) {
      const oItem = oEvent.getSource().getParent().getParent().getParent();
      const oContext = oItem.getBindingContext("app");
      const sSiteId = oContext.getProperty("SiteId");
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.navTo("edit", { siteId: sSiteId });
    },

    onDeleteDraftPress: function (oEvent) {
      const oItem = oEvent.getSource().getParent().getParent().getParent();
      const oContext = oItem.getBindingContext("app");
      const sSiteId = oContext.getProperty("SiteId");

      MessageBox.confirm(this._getResourceBundle().getText("confirmDeleteDraft"), {
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            const aDrafts = this.getView().getModel("app").getProperty("/drafts");
            const aFiltered = aDrafts.filter(function (d) { return d.SiteId !== sSiteId; });
            this._saveDrafts(aFiltered);
            this._showMessage("draftDeleted");
          }
        }.bind(this)
      });
    },

    onDeletePress: function (oEvent) {
      const oButton = oEvent.getSource();
      const oContext = oButton.getBindingContext();
      const sSiteId = oContext.getProperty("ZsiteId");
      const sName = oContext.getProperty("AdName1");
      const sCity = oContext.getProperty("AdCity1");
      const sCountry = oContext.getProperty("Land1");

      if (!sSiteId) {
        MessageBox.warning(this._getResourceBundle().getText("siteIdMandatory"));
        return;
      }

      MessageBox.confirm(this._getResourceBundle().getText("confirmDelete"), {
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            const oView = this.getView();
            oView.setBusy(true);
            const oModel = oView.getModel();
            oModel.remove("/SiteSet('" + sSiteId + "')", {
              success: function () {
                oView.setBusy(false);
                const aPending = this._getPendingCRs().filter(function (c) { return c.SiteId !== sSiteId; });
                aPending.unshift({
                  SiteId: sSiteId,
                  Name: sName || sSiteId,
                  City: sCity || "",
                  Country: sCountry || "",
                  Action: "Delete",
                  SubmittedAt: new Date().toLocaleString()
                });
                this._savePendingCRs(aPending);
                oModel.refresh();
                this._showMessage("siteDeleted");
              }.bind(this),
              error: function (oError) {
                oView.setBusy(false);
                const sMsg = this._extractErrorMessage(oError, "deleteError", sSiteId);
                MessageBox.warning(sMsg, { title: "MDG Governance Queue Notice" });
              }.bind(this)
            });
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
      if (sMsg.indexOf("ENQUEUE_ENTITY") >= 0 || sMsg.indexOf("WRITE_ENTITY") >= 0 || sMsg.indexOf("DELETE_ENTITY") >= 0 || sMsg.indexOf("already in an open") >= 0) {
        return "Site '" + (sSiteId || "") + "' is already in the SAP MDG Change Request queue awaiting approval.\n\nPlease approve or reject the existing Change Request in MDG before submitting another change for this Site.";
      }
      return sMsg;
    }

  });
});