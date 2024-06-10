// Define the area of interest (AOI) as Austin, Texas with a rectangular buffer
var austinCoords = ee.Geometry.Point([-97.7431, 30.2672]);
var bufferSize = 10000; // 10 km

// Create a rectangular buffer around the point
var aoi = austinCoords.buffer(bufferSize).bounds();

Map.addLayer(aoi, {}, 'AOI - Austin');
Map.centerObject(aoi, 11);

// Define start and end date
var startDate = ee.Date('2014-01-01');
var endDate = ee.Date('2023-12-31');

// Get the list of dates with available Dynamic World images
var imageCollection = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                        .filterBounds(aoi)
                        .filterDate(startDate, endDate);

var dates = imageCollection.aggregate_array('system:time_start')
                            .map(function(date) {
                              return ee.Date(date).format('YYYY-MM-dd');
                            });

dates.evaluate(function(datesList) {
  // Loop through each date and process images
  datesList.forEach(function(date) {
    var dateStart = ee.Date(date);
    var dateEnd = dateStart.advance(1, 'day');

    // Filter images for the specific date
    var dailyImages = imageCollection
                      .filterDate(dateStart, dateEnd)
                      .median()
                      .clip(aoi);

    // Select Water and Flooded Vegetation Bands
    var water = dailyImages.select('water').rename('Water');
    var floodedVegetation = dailyImages.select('flooded_vegetation').rename('Flooded_Vegetation');

    // Add the Water and Flooded Vegetation Layers to the Map with improved palettes
    Map.addLayer(water, {min: 0, max: 1, palette: ['0000FF', '00FFFF', 'ADD8E6']}, 'Water ' + date);
    Map.addLayer(floodedVegetation, {min: 0, max: 1, palette: ['006400', '00FF00', 'ADFF2F']}, 'Flooded Vegetation ' + date);

    // Export Water and Flooded Vegetation images to Google Drive as GeoTIFF
    Export.image.toDrive({
      image: water,
      description: 'Water_DynamicWorld_Austin_' + date + '_GeoTIFF',
      folder: 'flood',
      scale: 10,
      region: aoi,
      fileFormat: 'GeoTIFF'
    });

    Export.image.toDrive({
      image: floodedVegetation,
      description: 'FloodedVegetation_DynamicWorld_Austin_' + date + '_GeoTIFF',
      folder: 'flood',
      scale: 10,
      region: aoi,
      fileFormat: 'GeoTIFF'
    });
  });
});

