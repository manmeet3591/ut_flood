var geometry = 
    /* color: #98ff00 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-98.12794857910407, 30.733476337243932],
          [-98.12794857910407, 30.036902398019958],
          [-97.27101498535407, 30.036902398019958],
          [-97.27101498535407, 30.733476337243932]]], null, false);



// Define your area of interest (geometry)
var aoi = geometry;

// Date range since 2014
var startDate = '2014-01-01';
var endDate = ee.Date(Date.now()); // Use the current date as the end date

// 1. Retrieve SAR Imagery Dates (Sentinel-1)
var sarCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
                      .filterBounds(aoi)
                      .filterDate(startDate, endDate);

var sarDates = sarCollection.aggregate_array('system:time_start')
                  .map(function(time) {
                    return ee.Date(time).format('YYYY-MM-dd');
                  });

// Export SAR Imagery Dates
Export.table.toDrive({
  collection: ee.FeatureCollection(sarDates.map(function(date) {
    return ee.Feature(null, {'SAR_Date': date});
  })),
  description: 'SAR_Imagery_Dates_Since_2014',
  fileFormat: 'CSV'
});

// 2. Calculate and Export Average Daily Precipitation Using CHIRPS
var chirpsCollection = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
                          .filterBounds(aoi)
                          .filterDate(startDate, endDate);

var dailyPrecipitation = chirpsCollection.map(function(image) {
  var date = image.date();
  var precipitation = image.select('precipitation').reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 5000,
    maxPixels: 1e9
  }).get('precipitation');
  
  return ee.Feature(null, {
    'Date': date.format('YYYY-MM-dd'),
    'Average_Precipitation': precipitation
  });
});

// Filter out days with zero or null precipitation
var nonZeroPrecipitation = dailyPrecipitation.filter(ee.Filter.gt('Average_Precipitation', 0));

// Print or export the result

// Export Average Daily Precipitation
Export.table.toDrive({
  collection: ee.FeatureCollection(dailyPrecipitation),
  description: 'Average_Daily_Precipitation_CHIRPS',
  fileFormat: 'CSV'
});

// 3. Find and Export Dates with Both Precipitation and SAR Imagery Available
// var commonDates = chirpsCollection.filterDate(startDate, endDate)
//                     .map(function(image) {
//                       var date = image.date().format('YYYY-MM-dd');
//                       var hasSar = sarDates.contains(date);
//                       return ee.Feature(null, {
//                         'Date': date,
//                         'Has_SAR': hasSar
//                       });
//                     })
//                     .filter(ee.Filter.eq('Has_SAR', true));
                    
                    
// Step 2: Find common dates with SAR imagery available
var commonDates = nonZeroPrecipitation.map(function(feature) {
  var date = feature.getString('Date');
  var hasSar = sarDates.contains(date);
  return feature.set('Has_SAR', hasSar);
}).filter(ee.Filter.eq('Has_SAR', true));


// Step 3: Export the common dates to Drive
Export.table.toDrive({
  collection: commonDates,
  description: 'Common_NonZero_Precipitation_and_SAR_Dates',
  fileFormat: 'CSV'
});

// // Export Common Dates
// Export.table.toDrive({
//   collection: commonDates,
//   description: 'Common_Precipitation_and_SAR_Dates',
//   fileFormat: 'CSV'
// });

// 4. Find SAR Imagery Dates with Precipitation the Day Before
// var sarWithPrecipDayBefore = sarCollection.map(function(sarImage) {
//   var sarDate = sarImage.date();
  
//   // Get the CHIRPS image for the day before
//   var precipImage = chirpsCollection
//     .filterDate(sarDate.advance(-1, 'day'), sarDate)
//     .first();
  
//   // Check if the precipitation image exists
//   var precipitationDayBefore = ee.Algorithms.If(
//     precipImage,
//     precipImage.select('precipitation').reduceRegion({
//       reducer: ee.Reducer.mean(),
//       geometry: aoi,
//       scale: 5000,
//       maxPixels: 1e9
//     }).get('precipitation'),
//     null // Return null if no precipitation image is found
//   );
  
//   // Only keep SAR dates where precipitation data is available for the day before
//   return ee.Algorithms.If(
//     precipitationDayBefore !== null, // Check if precipitation is not null
//     ee.Feature(null, {
//       'SAR_Date': sarDate.format('YYYY-MM-dd'),
//       'Precipitation_Day_Before': precipitationDayBefore
//     }),
//     null // Return null if no precipitation data is found
//   );
// }).filter(ee.Filter.notNull(['SAR_Date'])); // Filter out null results

// // Export SAR Imagery Dates with Precipitation the Day Before
// Export.table.toDrive({
//   collection: ee.FeatureCollection(sarWithPrecipDayBefore),
//   description: 'SAR_With_Precipitation_Day_Before',
//   fileFormat: 'CSV'
// });
// Step 1: Find SAR Imagery Dates with Non-Zero Precipitation the Day Before
// Step 1: Get the list of dates with non-zero precipitation
// Step 1: Get the list of dates with non-zero precipitation
// Step 2: Convert SAR dates and non-zero precipitation dates to lists


var sarDatesList = ee.List(sarDates);
var precipDatesList = nonZeroPrecipitation.aggregate_array('Date');

// Step 3: Compare each precipitation date with SAR dates to check if there is a match the next day
var matchedDates = precipDatesList.map(function(precipDate) {
  var nextDay = ee.Date(precipDate).advance(1, 'day').format('YYYY-MM-dd');
  
  // Check if the next day is in the SAR dates list
  var isMatch = sarDatesList.contains(nextDay);
  
  // Return a feature if there's a match
  return ee.Algorithms.If(
    isMatch,
    ee.Feature(null, {
      'SAR_Date': nextDay,
      'Precipitation_Date': precipDate
    }),
    null // Return null if no match is found
  );
});

// Step 4: Filter out null results
var filteredMatchedDates = ee.FeatureCollection(matchedDates).filter(ee.Filter.notNull(['SAR_Date']));

// Step 5: Export the matched results to Drive
Export.table.toDrive({
  collection: filteredMatchedDates,
  description: 'SAR_Dates_With_NonZero_Precip_Day_Before',
  fileFormat: 'CSV'
});

// Optional: Print the matched results for visualization
print(filteredMatchedDates);

// Visualize
// print(nonZeroPrecipitation);
print('SAR Imagery Dates:', sarDates);
print('Daily Precipitation:', dailyPrecipitation);
print('Common Precipitation and SAR Dates:', commonDates);
// print('SAR Dates with Precipitation the Day Before:', sarWithPrecipDayBefore);


// 6. Retrieve exact SAR times for dates in commonDates and add Simple_Date and Average_Precipitation
var exactSarTimes = commonDates.map(function(feature) {
  var date = feature.getString('Date');
  
  // Filter SAR images on the exact date
  var sarMatch = sarCollection.filter(ee.Filter.date(date, ee.Date(date).advance(1, 'day'))).first();
  
  // Extract the exact time from the SAR image if available
  var sarTime = ee.Algorithms.If(
    sarMatch,
    ee.Date(sarMatch.get('system:time_start')).format('YYYY-MM-dd HH:mm:ss'),
    null
  );
  
  // Retrieve Average Precipitation for the specific date
  var avgPrecipitation = feature.get('Average_Precipitation');
  
  // Set Simple_Date as just the date without time
  var simpleDate = date;
  
  return feature.set({
    'SAR_Time': sarTime,
    'Simple_Date': simpleDate,
    'Average_Precipitation': avgPrecipitation
  });
});

// Export the common dates with exact SAR time, Simple_Date, and Average_Precipitation to Drive
Export.table.toDrive({
  collection: exactSarTimes,
  description: 'Common_NonZero_Precipitation_and_SAR_Dates_With_Exact_Time_Precip',
  fileFormat: 'CSV'
});

// Optional: Print the common dates with exact SAR time, Simple_Date, and Average_Precipitation for visualization
print('Common Precipitation and SAR Dates with Exact Time, Simple Date, and Average Precipitation:', exactSarTimes);
