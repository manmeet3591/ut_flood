var aoi = geometry;

// ==============================================================
// Step 1: Define Pre-Flood and Post-Flood Dates
// ==============================================================

var preFloodStartDate = '2018-09-10';
var preFloodEndDate = '2018-09-21';
var postFloodStartDate = '2018-09-22';
var postFloodEndDate = '2018-09-30';
// ==============================================================
// Step 2: Compare Image Collection Sizes for ASCENDING and DESCENDING
// ==============================================================

// Function to get image collection size for a given pass direction
function getCollectionSize(passDirection) {
  var preFloodCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
                              .filterBounds(aoi)
                              .filterDate(preFloodStartDate, preFloodEndDate)
                              .filter(ee.Filter.eq('instrumentMode', 'IW'))
                              .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                              .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                              .filter(ee.Filter.eq('orbitProperties_pass', passDirection));

  var postFloodCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
                               .filterBounds(aoi)
                               .filterDate(postFloodStartDate, postFloodEndDate)
                               .filter(ee.Filter.eq('instrumentMode', 'IW'))
                               .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                               .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                               .filter(ee.Filter.eq('orbitProperties_pass', passDirection));
  
  return preFloodCollection.size().add(postFloodCollection.size());
}

// Get sizes for both pass directions
var ascendingSize = getCollectionSize('ASCENDING');
var descendingSize = getCollectionSize('DESCENDING');

// Determine the best pass direction
var bestPassDirection = ee.String(
  ee.Algorithms.If(ascendingSize.gt(descendingSize), 'ASCENDING', 'DESCENDING')
);

// ==============================================================
// Step 3: Set Thresholds Based on the Selected Pass Direction
// ==============================================================

var floodThreshold = ee.Algorithms.If(
  bestPassDirection.compareTo('ASCENDING').eq(0),  // Compare the pass direction
  1.25,  // Positive threshold for ASCENDING
  -1.25  // Negative threshold for DESCENDING
);

// Convert the threshold to an image
var thresholdImage = ee.Image.constant(floodThreshold);

// ==============================================================
// Step 4: Use the Best Pass Direction for Further Processing
// ==============================================================

// Filter Sentinel-1 Image Collection with the best pass direction
var preFloodCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
                            .filterBounds(aoi)
                            .filterDate(preFloodStartDate, preFloodEndDate)
                            .filter(ee.Filter.eq('instrumentMode', 'IW'))
                            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                            .filter(ee.Filter.eq('orbitProperties_pass', bestPassDirection));

var postFloodCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
                             .filterBounds(aoi)
                             .filterDate(postFloodStartDate, postFloodEndDate)
                             .filter(ee.Filter.eq('instrumentMode', 'IW'))
                             .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                             .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                             .filter(ee.Filter.eq('orbitProperties_pass', bestPassDirection));

// Create mosaic composites for pre- and post-flood by mosaicking multiple images
var preFloodImage = preFloodCollection.mosaic().clip(aoi);
var postFloodImage = postFloodCollection.mosaic().clip(aoi);

// ==============================================================
// Step 5: Apply Threshold to Identify Flooded Areas
// ==============================================================

// Calculate the difference in VH band
var vhDiff = postFloodImage.select('VH').subtract(preFloodImage.select('VH')).rename('VH_Difference');

// Apply the threshold
var floodExtent = vhDiff.lt(thresholdImage).selfMask();

// ==============================================================
// Step 6: Refining the Flood Extent with Slope and Water Masks
// ==============================================================

// Load DEM and calculate slope
var DEM = ee.Image('WWF/HydroSHEDS/03VFDEM');
var terrain = ee.Algorithms.Terrain(DEM);
var slope = terrain.select('slope');

// Mask out areas with slope > 5%
var slopeMask = slope.lte(10);
var floodExtentFiltered = floodExtent.updateMask(slopeMask);

// Load the JRC Global Surface Water dataset to mask out permanent water bodies
var jrcWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
                  .select('occurrence')
                  .clip(aoi);

var permanentWaterMask = jrcWater.lt(10);  // Areas with water less than 10 months a year
floodExtentFiltered = floodExtentFiltered.updateMask(permanentWaterMask);

// ==============================================================
// Step 7: Visualization and Export
// ==============================================================

Map.centerObject(aoi, 10);
Map.addLayer(vhDiff, {min: -10, max: 10, palette: ['blue', 'white', 'red']}, 'VH Difference');
Map.addLayer(floodExtentFiltered, {palette: ['red']}, 'Refined Flood Extent');

// Export the refined flood extent as a GeoTIFF
Export.image.toDrive({
  image: floodExtentFiltered,
  description: 'Refined_Flood_Extent_' + postFloodStartDate,
  scale: 30,
  region: aoi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});
