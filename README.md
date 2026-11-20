# How to Build a Custom SAP Fiori Application for SAP MDG Custom Objects

![SAP](https://img.shields.io/badge/SAP-Fiori%20%7C%20MDG-0FAAFF?style=flat-square&logo=sap)
![OData](https://img.shields.io/badge/SAP%20Gateway-OData%20V2-00599C?style=flat-square)
![SAPUI5](https://img.shields.io/badge/SAPUI5-Freestyle-FF6C37?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

> **A step-by-step implementation guide to building an OData V2 service in SEGW and deploying a custom SAP Fiori (SAPUI5) application for a custom SAP MDG object in Reuse Mode.**

---

## 🔗 Prerequisite — Foundation MDG Implementation (Part 1)

This project is built on top of our custom **Site** master data object implemented in **SAP MDG Reuse Mode**. Before starting this guide, make sure you have completed the base MDG configuration (DDIC table `YMDG_SITE`, structure `ZMDG_SITE_S`, access class `ZCL_MDG_SITE_ACCESS`, Data Model `ZK`, and Change Request type `ZKCREATE`):

👉 **[Part 1: How to Create a Custom Object with Reuse Mode in SAP MDG](https://github.com/E2cyber/sap-mdg-custom-site-reuse-mode)**

---

## 📖 Introduction

While SAP MDG provides standard Floorplan Manager (FPM / WebDynpro) screens for master data governance, business users often prefer a modern, simplified **SAP Fiori** user experience on the SAP Fiori Launchpad.

In this guide, we build and deploy a custom **SAPUI5 / Fiori application** (`ZMDG_SITE_FIORI`) connected to a custom **SAP Gateway OData V2 service** (`ZGW_SITE_SRV`). All Create, Update, and Delete actions performed in the Fiori app automatically trigger **SAP MDG Change Requests** (`ZKCREATE`) and workflow approval (`WS46000027`) rather than modifying the active database table (`YMDG_SITE`) directly.

### 🎯 Why This Approach?

- ✅ **Modern Fiori UX:** Clean dashboard with KPI cards (Total Sites, Pending Approvals, Local Drafts), unified search, and responsive forms
- ✅ **Full MDG Governance Preserved:** Every create, edit, and delete operation routes through an MDG Change Request and workflow
- ✅ **End-to-End CRUD Support:** Complete OData V2 implementation (`GET_ENTITYSET`, `GET_ENTITY`, `CREATE_ENTITY`, `UPDATE_ENTITY`, `DELETE_ENTITY`)
- ✅ **Local Draft Support:** Users can save drafts locally before submitting Change Requests to SAP MDG

---

## 🏗️ Solution Architecture

| Component | Technical Name | Description |
|-----------|----------------|-------------|
| **Prerequisite MDG Model** | `ZK` (Entity `SITE`) | Custom MDG Reuse Mode model ([See Part 1 Repo](https://github.com/E2cyber/sap-mdg-custom-site-reuse-mode)) |
| **Active Database Table** | `YMDG_SITE` | Custom ERP table storing approved Site records |
| **DDIC Structure** | `ZMDG_SITE_S` | Structure used for OData Entity `Site` |
| **MDG Staging Structure** | `ZSZK_S_ZK_PP_SITE` | Generated MDG PP structure for Entity `SITE` |
| **SEGW Project** | `ZGW_SITE_SRV` | SAP Gateway Service Builder project |
| **Registered OData Service** | `ZGW_SITE_SRV_SRV` | Activated OData V2 service in `/IWFND/MAINT_SERVICE` |
| **DPC Extension Class** | `ZCL_ZGW_SITE_SRV_DPC_EXT` | Backend ABAP class implementing all 5 OData CRUD methods |
| **SAPUI5 BSP Application** | `ZMDG_SITE_FIORI` | Uploaded via `/UI5/UI5_REPOSITORY_LOAD` (`SE38`) and verified in `SE80` |
| **Fiori Launchpad Objects** | `ZMDG_SITE` / `Z_MDG_SITE_ROLE` | Semantic Object, Catalog (`Z_MDG_SITE_CAT`), Group (`Z_MDG_SITE_GRP`), and PFCG Role |

---

## 📋 Implementation Guide

Follow these phases in sequence to implement the OData backend and Fiori application:

### Phase 1: [OData Project Creation in SEGW & Service Activation](docs/01-odata-service-segw.md)
Create the OData foundation:
- Create project `ZGW_SITE_SRV` in transaction `SEGW`
- Import DDIC structure `ZMDG_SITE_S` to create Entity Type `Site` and Entity Set `SiteSet`
- Generate runtime artifacts (`DPC_EXT` & `MPC_EXT`)
- Register and activate service `ZGW_SITE_SRV_SRV` in `/IWFND/MAINT_SERVICE`

### Phase 2: [Backend OData CRUD Implementation (`DPC_EXT`)](docs/02-dpc-ext-implementation.md)
Implement the 5 core methods in `ZCL_ZGW_SITE_SRV_DPC_EXT`:
- `SITESET_GET_ENTITYSET` — Query active Sites and support OData `$filter`
- `SITESET_GET_ENTITY` — Read single Site details
- `SITESET_CREATE_ENTITY` — Create a new Site via MDG Change Request
- `SITESET_UPDATE_ENTITY` — Update an existing Site via MDG Change Request
- `SITESET_DELETE_ENTITY` — Delete a Site via MDG Change Request

### Phase 3: [Gateway Client Testing & Fixing CSRF Token Validation in SICF](docs/03-gateway-testing-csrf-fix.md)
Test and troubleshoot the OData service:
- Test `GET` requests in `/IWFND/GW_CLIENT`
- Resolve `403 Forbidden: CSRF token validation failed` over HTTP by configuring `~CHECK_CSRF_TOKEN = 0` in `SICF`
- Test `POST`, `PUT`, and `DELETE` payloads in `/IWFND/GW_CLIENT`

### Phase 4: [Deploying the SAPUI5 Application to ABAP Repository (`SE38` & `SE80`)](docs/04-fiori-app-deployment.md)
Upload the Fiori frontend code into SAP:
- Prepare the SAPUI5 project files (`fiori-app/`)
- Upload to BSP Application `ZMDG_SITE_FIORI` using report `/UI5/UI5_REPOSITORY_LOAD` in `SE38`
- Verify uploaded fragments in `SE80` (`BSP Application`)
- Recalculate the application index using `/UI5/APP_INDEX_CALCULATE`

### Phase 5: [Fiori Launchpad Tile, Catalog & Role Configuration (`PFCG`)](docs/05-flp-tile-and-role-setup.md)
Expose the application on the SAP Fiori Launchpad:
- Create Semantic Object `ZMDG_SITE` in `/UI2/SEMOBJ`
- Configure Catalog `Z_MDG_SITE_CAT`, Target Mapping, Static Tile, and Group `Z_MDG_SITE_GRP` in `/UI2/FLPD_CUST`
- Create PFCG Role `Z_MDG_SITE_ROLE`, generate authorization profile, and assign to user
- End-to-end testing in SAP Fiori Launchpad (`/UI2/FLP`)

---

## 📂 What's Inside

```text
sap-fiori-mdg-custom-site/
│
├── docs/
│   ├── images/
│   │   ├── phase1/   (Screenshots: SEGW project, Entity Site, Runtime Artifacts, MAINT_SERVICE)
│   │   ├── phase2/   (Screenshots: DPC_EXT class & method implementations)
│   │   ├── phase3/   (Screenshots: Gateway Client GET/POST/PUT/DELETE & SICF ~CHECK_CSRF_TOKEN=0)
│   │   ├── phase4/   (Screenshots: SE38 /UI5/UI5_REPOSITORY_LOAD & SE80 BSP Application tree)
│   │   └── phase5/   (Screenshots: PFCG Role, Fiori Launchpad Tile, Dashboard & Create Form)
│   │
│   ├── 01-odata-service-segw.md
│   ├── 02-dpc-ext-implementation.md
│   ├── 03-gateway-testing-csrf-fix.md
│   ├── 04-fiori-app-deployment.md
│   └── 05-flp-tile-and-role-setup.md
│
├── fiori-app/        (Complete SAPUI5 / Fiori Frontend Source Code)
│   ├── controller/
│   ├── css/
│   ├── i18n/
│   ├── model/
│   ├── view/
│   ├── Component.js
│   └── manifest.json
│
├── LICENSE
└── README.md
```

---

## 👤 Author

**Naveen Neelakandan**  
SAP MDG Consultant

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Found This Helpful?

If this guide helped you build a custom Fiori app for SAP MDG, please:
- ⭐ **Star this repository** (and [Part 1: SAP MDG Custom Site Reuse Mode](https://github.com/E2cyber/sap-mdg-custom-site-reuse-mode))
- 🔄 **Share with your network**
- 💬 **Leave feedback or questions in Issues**

---

**Happy Implementing! 🚀**

💬 Leave feedback or questions in Issues

Happy Implementing! 🚀



