require([
  "dojo/text!./config.json",
  "esri/config",
  "esri/WebMap",
  "esri/views/MapView",
  "esri/widgets/BasemapGallery",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Editor",
  "esri/widgets/Sketch",
  "esri/layers/GraphicsLayer",
  "esri/widgets/Expand"
], function(config, esriConfig, WebMap, MapView, BasemapGallery, LayerList, Legend, Editor, Sketch, GraphicsLayer, Expand) {
  const appConfig = JSON.parse(config);
  // esriConfig.portalUrl = appConfig.portalURL;
  params = new URLSearchParams(window.location.search)

  esriConfig.portalUrl = params.get("portalUrl") ?? "https://www.arcgis.com/";

  const webmapId = params.get("webmap")
    ?? "0ebe9cf75e1748c290706fa66294c629"; // "cc3bd744b9a44feaa493dd867a1d48dd";

  const isEditing = params.get("edit") == 'true' ?? false;

  const map = new WebMap({
    portalItem: {
      id: webmapId
    }
  });

  const view = new MapView({
    map,
    container: "viewDiv",
    padding: {
      left: 49
    }
  });

  view.ui.move("zoom", "top-left");

  const basemaps = new BasemapGallery({
    view,
    container: "basemaps-container"
  });

  const editor = new Editor({
    view,
    container: "editor-container",
    allowedWorkflows: ["create-features", "update"]
  });

  const layerList = new LayerList({
    view,
    selectionEnabled: true,
    container: "layers-container"
  });

  const legend = new Legend({
    view,
    container: "legend-container"
  });

  const sketchLayer = new GraphicsLayer({
    title: "Sketches"
  });
  const sketch = new Sketch({
    layer: sketchLayer,
    view: view,
    container: "sketch-container",
    creationMode: "update"
  });

  const sketchExpand = new Expand({
    view: view,
    content: document.getElementById("sketch-container"),
    expanded: true,
    expandIconClass: "esri-icon-edit",
    expandTooltip: "Open Styler"    
  })
  view.when(() => {
    view.ui.add(sketchExpand, "bottom-right");
  })

  map.when(() => {
    map.add(sketchLayer);
    const { title, description, thumbnailUrl, avgRating } = map.portalItem;
    document.querySelector("#header-title").textContent = title;

    let activeWidget;

    const handleActionBarClick = ({ target }) => {
      if (target.tagName !== "CALCITE-ACTION") {
        return;
      }

      if (activeWidget) {
        document.querySelector(`[data-action-id=${activeWidget}]`).active = false;
        document.querySelector(`[data-panel-id=${activeWidget}]`).hidden = true;
      }

      const nextWidget = target.dataset.actionId;
      if (nextWidget !== activeWidget) {
        document.querySelector(`[data-action-id=${nextWidget}]`).active = true;
        document.querySelector(`[data-panel-id=${nextWidget}]`).hidden = false;
        activeWidget = nextWidget;
      } else {
        activeWidget = null;
      }
    };

    if (isEditing){
      document.querySelector(`[data-action-id="editor"]`).disabled = false;
    }

    document.querySelector("calcite-action-bar").addEventListener("click", handleActionBarClick);

    let actionBarExpanded = false;

    document.addEventListener("calciteActionBarToggle", event => {
      actionBarExpanded = !actionBarExpanded;
      view.padding = {
        left: actionBarExpanded ? 135 : 45
      };
    });

    // Filter testing

    function buildMultiCategoryWhere(columnName, values) {
      let out_where = ""
      values.forEach(v => {
        out_where += columnName + "='" + v + "' OR ";
      })
      return out_where.slice(0, out_where.length-4)
    }

    function zoomTo(e) {
      const values = e.detail.selectedItems.map(item => item.value);
      layer = map.allLayers.items.find(l => l.title === e.target.layerName);
      const query = layer.createQuery();
      query.where = buildMultiCategoryWhere(e.target.columnName,  values);
      layer.queryExtent(query)
        .then(response => {
          view.goTo(response.extent);
        })      
    }
    function filterRecords(e) {
      e.target.targetLayers.forEach(l => {
        const values = e.detail.selectedItems.map(item => item.value);
        layer = map.allLayers.items.find(lyr => lyr.title === Object.keys(l)[0]);
        console.log(layer)
        layer.definitionExpression = buildMultiCategoryWhere(l[Object.keys(l)[0]], values);
      })
    }

    appConfig.categoryFilters.forEach(filter => {
      const headerControls = document.querySelector(`[id="header-controls"]`);
      const layer = map.allLayers.items.find(l => l.title === filter.listLayerTitle);
      const listLayerColumn = filter.targetLayers.find(l => l.hasOwnProperty(filter.listLayerTitle))[filter.listLayerTitle];
      if (!layer) {return;}
      const query = layer.createQuery();
      query.where = "1=1";
      query.outFields = [listLayerColumn];
      layer.queryFeatures(query)
        .then(response => {
          const uniqueValues = [];
          response.features.forEach(feature => {
            const attr = feature.attributes[listLayerColumn];
            if (!uniqueValues.includes(attr)){
              uniqueValues.push(attr);
            }
          })
          const combobox = document.createElement('calcite-combobox');
          combobox.layout = "inline";
          combobox.style.float = "left";
          combobox.targetLayers = filter.targetLayers;
          combobox.setAttribute("selection-mode", filter.multiSelect ? "multi": "single");
          uniqueValues.forEach(value => {
            const boxItem = document.createElement('calcite-combobox-item');
            boxItem.value = value;
            boxItem.setAttribute('text-label', value);
            combobox.appendChild(boxItem);
          })
          if (filter.zoomTo){
            combobox.addEventListener("calciteComboboxChange", zoomTo);
          }
          if (filter.filterRecords){
            combobox.addEventListener("calciteComboboxChange", filterRecords);
          }
          headerControls.insertBefore(combobox, headerControls.childNodes[0])
        })
    });

    // End Filter testing

    document.querySelector("calcite-shell").hidden = false;
    document.querySelector("calcite-loader").active = false;

    const toggleThemes = () => {
      // Calcite theme
      document.body.classList.toggle("calcite-theme-dark");
      // ArcGIS JSAPI theme
      const dark = document.querySelector("#jsapi-theme-dark");
      const light = document.querySelector("#jsapi-theme-light");
      dark.disabled = !dark.disabled;
      light.disabled = !light.disabled;
      // ArcGIS JSAPI basemap
      map.basemap = dark.disabled ? "gray-vector" : "dark-gray-vector";
    };

    document.querySelector("calcite-switch").addEventListener("calciteSwitchChange", toggleThemes);

  });
});