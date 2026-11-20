# Phase 2: Service Implementation & Redefining CRUD Methods

## Overview

In this phase, we navigate from **Service Implementation** inside our **SEGW** project (`ZGW_SITE_SRV`) to the ABAP Workbench, redefine the 5 CRUD methods for `SiteSet`, implement the backend logic, and activate the methods.

---

## 2.1 Implement `Create` (`SITESET_CREATE_ENTITY`)

### Step 1: Navigate to ABAP Workbench from SEGW
1. Open transaction **SEGW** and expand project **`ZGW_SITE_SRV`**
2. Expand **Service Implementation** → expand **`SiteSet`**
3. Right-click on **`Create`** and select **Go to ABAP Workbench**
   *(If an information popup appears stating the method is not yet implemented, click **Continue**)*

![SEGW Service Implementation Go to ABAP Workbench](images/phase2/01-segw-service-implementation.png)

---

### Step 2: Redefine `SITESET_CREATE_ENTITY`
1. In the Class Builder screen (`ZCL_ZGW_SITE_SRV_DPC_EXT`), expand the **Methods** folder → expand **Inherited Methods**
2. Locate **`SITESET_CREATE_ENTITY`**
3. Right-click on **`SITESET_CREATE_ENTITY`** and select **Redefine**

![Redefine SITESET_CREATE_ENTITY](images/phase2/02-redefine-create-method.png)

---

### Step 3: Enter Code and Activate
1. Double-click on **`SITESET_CREATE_ENTITY`** (now listed under the **Redefinitions** folder)
2. Enter the ABAP code for the `Create` method:

```abap
METHOD siteset_create_entity.

  DATA: ls_site        TYPE zcl_zgw_site_srv_mpc=>ts_site,
        ls_mdg_site    TYPE zszk_s_zk_pp_site,
        lt_site_data   TYPE TABLE OF zszk_s_zk_pp_site,
        lt_site_key    TYPE TABLE OF zszk_s_zk_pp_site,
        ls_site_key    TYPE zszk_s_zk_pp_site,
        lv_crequest_id TYPE usmd_crequest,
        lv_description TYPE usmd_txtlg,
        lv_msg         TYPE bapi_msg,
        lv_step        TYPE string.

  "--- 1. Read incoming OData payload ----------------------------------
  IF io_data_provider IS BOUND.
    io_data_provider->read_entry_data( IMPORTING es_data = ls_site ).
  ELSE.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception.
  ENDIF.

  "--- 2. Validate mandatory key ---------------------------------------
  IF ls_site-zsite_id IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid  = /iwbep/cx_mgw_busi_exception=>business_error
        message = 'Site ID (ZsiteId) is mandatory.'.
  ENDIF.

  "--- 3. Build key table and data table -------------------------------
  CLEAR ls_site_key.
  ls_site_key-site = ls_site-zsite_id.
  APPEND ls_site_key TO lt_site_key.

  CLEAR ls_mdg_site.
  ls_mdg_site-site    = ls_site-zsite_id.
  ls_mdg_site-name    = ls_site-ad_name1.
  ls_mdg_site-city    = ls_site-ad_city1.
  ls_mdg_site-country = ls_site-land1.
  ls_mdg_site-street  = ls_site-ad_street.
  ls_mdg_site-zip     = ls_site-ad_pstcd1.
  ls_mdg_site-descr   = ls_site-ad_remark1.
  APPEND ls_mdg_site TO lt_site_data.

  lv_description = |Create Site { ls_site-zsite_id }|.

  "--- 4. MDG Governance API Sequence ----------------------------------
  TRY.
      lv_step = 'GET_INSTANCE'.
      DATA(lo_gov_api) = cl_usmd_gov_api=>get_instance( iv_model_name = 'ZK' ).

      lv_step = 'CREATE_CREQUEST'.
      lv_crequest_id = lo_gov_api->if_usmd_gov_api_cr_data~create_crequest(
        iv_crequest_type = 'ZKCREATE'
        iv_description   = lv_description
      ).

      lv_step = 'ENQUEUE_CREQUEST'.
      lo_gov_api->if_usmd_gov_api_cr_data~enqueue_crequest(
        iv_crequest_id = lv_crequest_id
      ).

      lv_step = 'ENQUEUE_ENTITY'.
      lo_gov_api->if_usmd_gov_api_entity~enqueue_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_key
      ).

      lv_step = 'WRITE_ENTITY'.
      lo_gov_api->if_usmd_gov_api_entity~write_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_data
      ).

      lv_step = 'CONFIRM_ENTITY_DATA'.
      lo_gov_api->if_usmd_gov_api_entity~confirm_entity_data( ).

      lv_step = 'SAVE'.
      lo_gov_api->if_usmd_gov_api_trans~save( i_mode = 'D' ).

      lv_step = 'START_WORKFLOW'.
      lo_gov_api->if_usmd_gov_api_process~start_workflow(
        iv_crequest_id = lv_crequest_id
      ).

      lv_step = 'DEQUEUE'.
      lo_gov_api->if_usmd_gov_api_entity~dequeue_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_key
      ).
      lo_gov_api->if_usmd_gov_api_cr_data~dequeue_crequest(
        iv_crequest_id = lv_crequest_id
      ).

      COMMIT WORK AND WAIT.

CATCH cx_usmd_gov_api_core_error
          cx_usmd_gov_api_entity_write
          cx_usmd_gov_api INTO DATA(lx_gov).

      IF lo_gov_api IS BOUND AND lv_crequest_id IS NOT INITIAL.
        TRY.
            lo_gov_api->if_usmd_gov_api_entity~dequeue_entity(
              iv_crequest_id = lv_crequest_id
              iv_entity_name = 'SITE'
              it_data        = lt_site_key " (use lt_site_data in DELETE_ENTITY)
            ).
            lo_gov_api->if_usmd_gov_api_cr_data~dequeue_crequest(
              iv_crequest_id = lv_crequest_id
            ).
          CATCH cx_root.
        ENDTRY.
      ENDIF.

      IF lv_step = 'ENQUEUE_ENTITY' OR lv_step = 'WRITE_ENTITY' OR lv_step = 'DELETE_ENTITY'.
        lv_msg = |Site { ls_site-zsite_id } is already in an open MDG Change Request awaiting approval.|.
      ELSE.
        lv_msg = |Step { lv_step } failed: { lx_gov->get_text( ) }|.
      ENDIF.

      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid  = /iwbep/cx_mgw_busi_exception=>business_error
          message = lv_msg.
  ENDTRY.

  er_entity = ls_site.

ENDMETHOD.
```

3. Click **Save** (`Ctrl+S`) and **Activate** (`Ctrl+F3`)

---

## 2.2 Implement `Delete` (`SITESET_DELETE_ENTITY`)

### Step 1: Redefine `SITESET_DELETE_ENTITY`
1. In `ZCL_ZGW_SITE_SRV_DPC_EXT`, under **Methods** → **Inherited Methods**, locate **`SITESET_DELETE_ENTITY`**
   *(Or from SEGW: **Service Implementation** → **`SiteSet`** → right-click **`Delete`** → **Go to ABAP Workbench**)*
2. Right-click on **`SITESET_DELETE_ENTITY`** and select **Redefine**

---

### Step 2: Enter Code and Activate
1. Double-click on **`SITESET_DELETE_ENTITY`** under **Redefinitions**
2. Enter the ABAP code for the `Delete` method:

```abap
METHOD siteset_delete_entity.

  DATA: lo_access      TYPE REF TO zcl_mdg_site_access,
        ls_site_key    TYPE zszk_s_zk_pp_site,
        lt_site_data   TYPE TABLE OF zszk_s_zk_pp_site,
        lv_crequest_id TYPE usmd_crequest,
        lv_description TYPE usmd_txtlg,
        lv_siteid      TYPE string,
        lv_msg         TYPE bapi_msg,
        lv_step        TYPE string.

  CREATE OBJECT lo_access.

  "--- 1. Extract Site ID from key table -------------------------------
  READ TABLE it_key_tab WITH KEY name = 'ZsiteId' INTO DATA(ls_key).
  IF sy-subrc <> 0.
    READ TABLE it_key_tab INDEX 1 INTO ls_key.
  ENDIF.
  IF ls_key-value IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid  = /iwbep/cx_mgw_busi_exception=>business_error
        message = 'Site ID key is missing.'.
  ENDIF.
  lv_siteid = ls_key-value.

  "--- 2. Validate that the Site exists in active area -----------------
  DATA: lt_sel      TYPE usmd_ts_sel,
        ls_sel      LIKE LINE OF lt_sel,
        lt_sites    TYPE TABLE OF zszk_s_zk_pp_site,
        lt_messages TYPE usmd_t_message.

  CLEAR ls_sel.
  ls_sel-fieldname = 'SITE'.
  ls_sel-sign      = 'I'.
  ls_sel-option    = 'EQ'.
  ls_sel-low       = lv_siteid.
  INSERT ls_sel INTO TABLE lt_sel.

  CALL METHOD lo_access->if_usmd_pp_access~read_value
    EXPORTING
      i_entity   = 'SITE'
      it_sel     = lt_sel
    IMPORTING
      et_data    = lt_sites
      et_message = lt_messages
    EXCEPTIONS
      others     = 1.

  IF sy-subrc <> 0 OR lt_sites IS INITIAL.
    lv_msg = |Site not found for delete: { lv_siteid }|.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid  = /iwbep/cx_mgw_busi_exception=>business_error
        message = lv_msg.
  ENDIF.

  "--- 3. Build MDG key structure for delete ---------------------------
  CLEAR ls_site_key.
  ls_site_key-site = lv_siteid.
  APPEND ls_site_key TO lt_site_data.

  lv_description = |Delete Site { lv_siteid }|.

  "--- 4. MDG Governance API Sequence ----------------------------------
  TRY.
      lv_step = 'GET_INSTANCE'.
      DATA(lo_gov_api) = cl_usmd_gov_api=>get_instance( iv_model_name = 'ZK' ).

      lv_step = 'CREATE_CREQUEST'.
      lv_crequest_id = lo_gov_api->if_usmd_gov_api_cr_data~create_crequest(
        iv_crequest_type = 'ZKCREATE'
        iv_description   = lv_description
      ).

      lv_step = 'ENQUEUE_CREQUEST'.
      lo_gov_api->if_usmd_gov_api_cr_data~enqueue_crequest(
        iv_crequest_id = lv_crequest_id
      ).

      lv_step = 'ENQUEUE_ENTITY'.
      lo_gov_api->if_usmd_gov_api_entity~enqueue_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_data
      ).

      lv_step = 'DELETE_ENTITY'.
      lo_gov_api->if_usmd_gov_api_entity~delete_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_data
      ).

      lv_step = 'CONFIRM_ENTITY_DATA'.
      lo_gov_api->if_usmd_gov_api_entity~confirm_entity_data( ).

      lv_step = 'SAVE'.
      lo_gov_api->if_usmd_gov_api_trans~save( i_mode = 'D' ).

      lv_step = 'START_WORKFLOW'.
      lo_gov_api->if_usmd_gov_api_process~start_workflow(
        iv_crequest_id = lv_crequest_id
      ).

      lv_step = 'DEQUEUE'.
      lo_gov_api->if_usmd_gov_api_entity~dequeue_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_data
      ).
      lo_gov_api->if_usmd_gov_api_cr_data~dequeue_crequest(
        iv_crequest_id = lv_crequest_id
      ).

      COMMIT WORK AND WAIT.

    CATCH cx_usmd_gov_api_core_error
          cx_usmd_gov_api_entity_del
          cx_usmd_gov_api INTO DATA(lx_gov).

      " Release any locks if an error occurred so next attempt isn't blocked
      IF lo_gov_api IS BOUND AND lv_crequest_id IS NOT INITIAL.
        TRY.
            lo_gov_api->if_usmd_gov_api_entity~dequeue_entity(
              iv_crequest_id = lv_crequest_id
              iv_entity_name = 'SITE'
              it_data        = lt_site_data
            ).
            lo_gov_api->if_usmd_gov_api_cr_data~dequeue_crequest(
              iv_crequest_id = lv_crequest_id
            ).
          CATCH cx_root.
        ENDTRY.
      ENDIF.

      IF lv_step = 'ENQUEUE_ENTITY' OR lv_step = 'DELETE_ENTITY'.
        lv_msg = |Site { lv_siteid } is already in an open MDG Change Request awaiting approval.|.
      ELSE.
        lv_msg = |Step { lv_step } failed: { lx_gov->get_text( ) }|.
      ENDIF.

      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid  = /iwbep/cx_mgw_busi_exception=>business_error
          message = lv_msg.
  ENDTRY.

ENDMETHOD.
```

3. Click **Save** (`Ctrl+S`) and **Activate** (`Ctrl+F3`)

---

## 2.3 Implement `GetEntity (Read)` (`SITESET_GET_ENTITY`)

### Step 1: Redefine `SITESET_GET_ENTITY`
1. Under **Methods** → **Inherited Methods**, locate **`SITESET_GET_ENTITY`**
2. Right-click on **`SITESET_GET_ENTITY`** and select **Redefine**

---

### Step 2: Enter Code and Activate
1. Double-click on **`SITESET_GET_ENTITY`** under **Redefinitions**
2. Enter the ABAP code for reading a single Site record:

```abap
METHOD siteset_get_entity.

  DATA: lt_sel      TYPE usmd_ts_sel,
        ls_sel      LIKE LINE OF lt_sel,
        lt_sites    TYPE TABLE OF zszk_s_zk_pp_site,
        ls_site     TYPE zszk_s_zk_pp_site,
        lt_messages TYPE usmd_t_message,
        lo_access   TYPE REF TO zcl_mdg_site_access,
        lv_siteid   TYPE string.

  CREATE OBJECT lo_access.

  "--- 1. Extract Site ID from key table -------------------------------
  READ TABLE it_key_tab WITH KEY name = 'ZsiteId' INTO DATA(ls_key).
  IF sy-subrc <> 0.
    READ TABLE it_key_tab INDEX 1 INTO ls_key.
  ENDIF.
  IF ls_key-value IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING message = 'Site ID key is missing.'.
  ENDIF.
  lv_siteid = ls_key-value.

  "--- 2. Build USMD selection table for READ_VALUE --------------------
  CLEAR ls_sel.
  ls_sel-fieldname = 'SITE'.
  ls_sel-sign      = 'I'.
  ls_sel-option    = 'EQ'.
  ls_sel-low       = lv_siteid.
  INSERT ls_sel INTO TABLE lt_sel.

  "--- 3. Call IF_USMD_PP_ACCESS~READ_VALUE ----------------------------
  CALL METHOD lo_access->if_usmd_pp_access~read_value
    EXPORTING
      i_entity   = 'SITE'
      it_sel     = lt_sel
    IMPORTING
      et_data    = lt_sites
      et_message = lt_messages
    EXCEPTIONS
      others     = 1.

  IF sy-subrc <> 0 OR lt_sites IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING message = |Site { lv_siteid } not found.|.
  ENDIF.

  READ TABLE lt_sites INDEX 1 INTO ls_site.

  er_entity-zsite_id   = ls_site-site.
  er_entity-ad_name1   = ls_site-name.
  er_entity-ad_city1   = ls_site-city.
  er_entity-land1      = ls_site-country.
  er_entity-ad_street  = ls_site-street.
  er_entity-ad_pstcd1  = ls_site-zip.
  er_entity-ad_remark1 = ls_site-descr.

ENDMETHOD.
```

3. Click **Save** (`Ctrl+S`) and **Activate** (`Ctrl+F3`)

---

## 2.4 Implement `GetEntitySet (Query)` (`SITESET_GET_ENTITYSET`)

### Step 1: Redefine `SITESET_GET_ENTITYSET`
1. Under **Methods** → **Inherited Methods**, locate **`SITESET_GET_ENTITYSET`**
2. Right-click on **`SITESET_GET_ENTITYSET`** and select **Redefine**

---

### Step 2: Enter Code and Activate
1. Double-click on **`SITESET_GET_ENTITYSET`** under **Redefinitions**
2. Enter the ABAP code for querying the Site entity set:

```abap
METHOD siteset_get_entityset.

  DATA: lt_sel      TYPE usmd_ts_sel,
        ls_sel      LIKE LINE OF lt_sel,
        " MUST use MDG staging structure ZSZK_S_ZK_PP_SITE because
        " ZCL_MDG_SITE_ACCESS->QUERY assigns components SITE, NAME, CITY, etc.
        lt_sites    TYPE TABLE OF zszk_s_zk_pp_site,
        ls_site     TYPE zszk_s_zk_pp_site,
        ls_entity   TYPE zcl_zgw_site_srv_mpc=>ts_site,
        lt_messages TYPE usmd_t_message,
        lo_access   TYPE REF TO zcl_mdg_site_access.

  CREATE OBJECT lo_access.

  "--- 1. Build USMD selection table from OData $filter options --------
  LOOP AT it_filter_select_options INTO DATA(ls_filter).
    LOOP AT ls_filter-select_options INTO DATA(ls_range).
      CLEAR ls_sel.
      CASE ls_filter-property.
        WHEN 'ZsiteId'   OR 'ZSITE_ID'.   ls_sel-fieldname = 'SITE'.
        WHEN 'AdName1'   OR 'AD_NAME1'.   ls_sel-fieldname = 'NAME'.
        WHEN 'AdCity1'   OR 'AD_CITY1'.   ls_sel-fieldname = 'CITY'.
        WHEN 'Land1'     OR 'LAND1'.      ls_sel-fieldname = 'COUNTRY'.
        WHEN 'AdStreet'  OR 'AD_STREET'.  ls_sel-fieldname = 'STREET'.
        WHEN 'AdPstcd1'  OR 'AD_PSTCD1'.  ls_sel-fieldname = 'ZIP'.
        WHEN 'AdRemark1' OR 'AD_REMARK1'. ls_sel-fieldname = 'DESCR'.
        WHEN OTHERS.                      ls_sel-fieldname = ls_filter-property.
      ENDCASE.
      ls_sel-sign   = ls_range-sign.
      ls_sel-option = ls_range-option.
      ls_sel-low    = ls_range-low.
      ls_sel-high   = ls_range-high.
      INSERT ls_sel INTO TABLE lt_sel.
    ENDLOOP.
  ENDLOOP.

  "--- 2. Call IF_USMD_PP_ACCESS~QUERY ---------------------------------
  CALL METHOD lo_access->if_usmd_pp_access~query
    EXPORTING
      i_entity         = 'SITE'
      it_sel           = lt_sel
      if_no_auth_check = abap_true
      i_num_entries    = 0
    IMPORTING
      et_data          = lt_sites
      et_message       = lt_messages
    EXCEPTIONS
      others           = 1.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception.
  ENDIF.

  "--- 3. Map MDG fields (SITE, NAME...) to OData entity set -----------
  LOOP AT lt_sites INTO ls_site.
    CLEAR ls_entity.
    ls_entity-zsite_id   = ls_site-site.
    ls_entity-ad_name1   = ls_site-name.
    ls_entity-ad_city1   = ls_site-city.
    ls_entity-land1      = ls_site-country.
    ls_entity-ad_street  = ls_site-street.
    ls_entity-ad_pstcd1  = ls_site-zip.
    ls_entity-ad_remark1 = ls_site-descr.
    APPEND ls_entity TO et_entityset.
  ENDLOOP.

ENDMETHOD.
```

3. Click **Save** (`Ctrl+S`) and **Activate** (`Ctrl+F3`)

---

## 2.5 Implement `Update` (`SITESET_UPDATE_ENTITY`)

### Step 1: Redefine `SITESET_UPDATE_ENTITY`
1. Under **Methods** → **Inherited Methods**, locate **`SITESET_UPDATE_ENTITY`**
2. Right-click on **`SITESET_UPDATE_ENTITY`** and select **Redefine**

---

### Step 2: Enter Code and Activate
1. Double-click on **`SITESET_UPDATE_ENTITY`** under **Redefinitions**
2. Enter the ABAP code for the `Update` method:

```abap
 METHOD siteset_update_entity.

  DATA: ls_site        TYPE zcl_zgw_site_srv_mpc=>ts_site,
        ls_mdg_site    TYPE zszk_s_zk_pp_site,
        lt_site_data   TYPE TABLE OF zszk_s_zk_pp_site,
        lt_site_key    TYPE TABLE OF zszk_s_zk_pp_site,
        ls_site_key    TYPE zszk_s_zk_pp_site,
        lv_crequest_id TYPE usmd_crequest,
        lv_description TYPE usmd_txtlg,
        lv_siteid      TYPE string,
        lv_msg         TYPE bapi_msg,
        lv_step        TYPE string.

  "--- 1. Extract Site ID from key table -------------------------------
  READ TABLE it_key_tab WITH KEY name = 'ZsiteId' INTO DATA(ls_key).
  IF sy-subrc <> 0.
    READ TABLE it_key_tab INDEX 1 INTO ls_key.
  ENDIF.
  IF ls_key-value IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid  = /iwbep/cx_mgw_busi_exception=>business_error
        message = 'Site ID key is missing.'.
  ENDIF.
  lv_siteid = ls_key-value.

  "--- 2. Read incoming OData payload ----------------------------------
  IF io_data_provider IS BOUND.
    io_data_provider->read_entry_data( IMPORTING es_data = ls_site ).
  ELSE.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception.
  ENDIF.

  IF ls_site-zsite_id IS INITIAL.
    ls_site-zsite_id = lv_siteid.
  ENDIF.

  "--- 3. Build key table and data table -------------------------------
  CLEAR ls_site_key.
  ls_site_key-site = ls_site-zsite_id.
  APPEND ls_site_key TO lt_site_key.

  CLEAR ls_mdg_site.
  ls_mdg_site-site    = ls_site-zsite_id.
  ls_mdg_site-name    = ls_site-ad_name1.
  ls_mdg_site-city    = ls_site-ad_city1.
  ls_mdg_site-country = ls_site-land1.
  ls_mdg_site-street  = ls_site-ad_street.
  ls_mdg_site-zip     = ls_site-ad_pstcd1.
  ls_mdg_site-descr   = ls_site-ad_remark1.
  APPEND ls_mdg_site TO lt_site_data.

  lv_description = |Update Site { ls_site-zsite_id }|.

  "--- 4. MDG Governance API Sequence ----------------------------------
  TRY.
      lv_step = 'GET_INSTANCE'.
      DATA(lo_gov_api) = cl_usmd_gov_api=>get_instance( iv_model_name = 'ZK' ).

      lv_step = 'CREATE_CREQUEST'.
      lv_crequest_id = lo_gov_api->if_usmd_gov_api_cr_data~create_crequest(
        iv_crequest_type = 'ZKCREATE'
        iv_description   = lv_description
      ).

      lv_step = 'ENQUEUE_CREQUEST'.
      lo_gov_api->if_usmd_gov_api_cr_data~enqueue_crequest(
        iv_crequest_id = lv_crequest_id
      ).

      lv_step = 'ENQUEUE_ENTITY'.
      lo_gov_api->if_usmd_gov_api_entity~enqueue_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_key
      ).

      lv_step = 'WRITE_ENTITY'.
      lo_gov_api->if_usmd_gov_api_entity~write_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_data
      ).

      lv_step = 'CONFIRM_ENTITY_DATA'.
      lo_gov_api->if_usmd_gov_api_entity~confirm_entity_data( ).

      lv_step = 'SAVE'.
      lo_gov_api->if_usmd_gov_api_trans~save( i_mode = 'D' ).

      lv_step = 'START_WORKFLOW'.
      lo_gov_api->if_usmd_gov_api_process~start_workflow(
        iv_crequest_id = lv_crequest_id
      ).

      lv_step = 'DEQUEUE'.
      lo_gov_api->if_usmd_gov_api_entity~dequeue_entity(
        iv_crequest_id = lv_crequest_id
        iv_entity_name = 'SITE'
        it_data        = lt_site_key
      ).
      lo_gov_api->if_usmd_gov_api_cr_data~dequeue_crequest(
        iv_crequest_id = lv_crequest_id
      ).

      COMMIT WORK AND WAIT.

CATCH cx_usmd_gov_api_core_error
          cx_usmd_gov_api_entity_write
          cx_usmd_gov_api INTO DATA(lx_gov).

      IF lo_gov_api IS BOUND AND lv_crequest_id IS NOT INITIAL.
        TRY.
            lo_gov_api->if_usmd_gov_api_entity~dequeue_entity(
              iv_crequest_id = lv_crequest_id
              iv_entity_name = 'SITE'
              it_data        = lt_site_key " (use lt_site_data in DELETE_ENTITY)
            ).
            lo_gov_api->if_usmd_gov_api_cr_data~dequeue_crequest(
              iv_crequest_id = lv_crequest_id
            ).
          CATCH cx_root.
        ENDTRY.
      ENDIF.

      IF lv_step = 'ENQUEUE_ENTITY' OR lv_step = 'WRITE_ENTITY' OR lv_step = 'DELETE_ENTITY'.
        lv_msg = |Site { ls_site-zsite_id } is already in an open MDG Change Request awaiting approval.|.
      ELSE.
        lv_msg = |Step { lv_step } failed: { lx_gov->get_text( ) }|.
      ENDIF.

      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid  = /iwbep/cx_mgw_busi_exception=>business_error
          message = lv_msg.
  ENDTRY.

  er_entity = ls_site.

ENDMETHOD.
```

3. Click **Save** (`Ctrl+S`) and **Activate** (`Ctrl+F3`) to activate the entire class **`ZCL_ZGW_SITE_SRV_DPC_EXT`**.

---

**Next Step:** [Phase 3: Gateway Client Testing & Fixing CSRF Token Validation in SICF](03-gateway-testing-csrf-fix.md)
```
