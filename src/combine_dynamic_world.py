import xarray as xr

# Open the datasets
ds_water = xr.open_dataset('dynamic_world_water_2015_2023.nc', chunks={'time': 1, 'lat': 100, 'lon': 100})
ds_flooded_vegetation = xr.open_dataset('dynamic_world_flooded_vegetation_2015_2023.nc', chunks={'time': 1, 'lat': 100, 'lon': 100})

# Ensure the datasets have the same dimensions
# You may need to align the datasets if their dimensions or coordinates do not perfectly match
ds_water, ds_flooded_vegetation = xr.align(ds_water, ds_flooded_vegetation)

# Stack the datasets along a new dimension
stacked = xr.concat([ds_water.water, ds_flooded_vegetation.flooded_vegetation], dim='new_dim')

# Compute the mean along the new dimension
water_combined_xr = stacked.mean(dim='new_dim', skipna=True)

print(water_combined_xr)

water_combined_xr.to_dataset().to_netcdf('dynamic_world_water_flooded_vegetation_2015_2023.nc')
#ds_water['water_combined'] = 


# print(ds_water_combined)
# ds_water_combined.to_netcdf('dynamic_world_water_combined_2015_2023.nc')