/**
 * Parse the animation speed
 * @param speed (string) The speed, in radians/degrees/revolutions per second/minute
 * @return (double) radians per second
 */
PhotoSphereViewer.prototype._parseAnimSpeed = function(speed) {
  speed = speed.toString().trim();

  // Speed extraction
  var speed_value = parseFloat(speed.replace(/^(-?[0-9]+(?:\.[0-9]*)?).*$/, '$1'));
  var speed_unit = speed.replace(/^-?[0-9]+(?:\.[0-9]*)?(.*)$/, '$1').trim();

  // "per minute" -> "per second"
  if (speed_unit.match(/(pm|per minute)$/)) {
    speed_value /= 60;
  }

  var rad_per_second = 0;

  // Which unit?
  switch (speed_unit) {
    // Degrees per minute / second
    case 'dpm':
    case 'degrees per minute':
    case 'dps':
    case 'degrees per second':
      rad_per_second = speed_value * Math.PI / 180;
      break;

    // Radians per minute / second
    case 'radians per minute':
    case 'radians per second':
      rad_per_second = speed_value;
      break;

    // Revolutions per minute / second
    case 'rpm':
    case 'revolutions per minute':
    case 'rps':
    case 'revolutions per second':
      rad_per_second = speed_value * PhotoSphereViewer.TwoPI;
      break;

    // Unknown unit
    default:
      throw new PSVError('unknown speed unit "' + speed_unit + '"');
  }

  return rad_per_second;
};

/**
 * Sets the viewer size
 * @param size (Object) An object containing the wanted width and height
 */
PhotoSphereViewer.prototype._setViewerSize = function(size) {
  ['width', 'height'].forEach(function(dim) {
    if (size[dim]) {
      if (/^[0-9.]+$/.test(size[dim])) size[dim] += 'px';
      this.parent.style[dim] = size[dim];
    }
  }, this);
};

/**
 * Converts pixel texture coordinates to spherical radians coordinates
 * @param x (int)
 * @param y (int)
 * @returns ({longitude: double, latitude: double})
 */
PhotoSphereViewer.prototype.textureCoordsToSphericalCoords = function(x, y) {
  var relativeX = x / this.prop.size.image_width * PhotoSphereViewer.TwoPI;
  var relativeY = y / this.prop.size.image_height * PhotoSphereViewer.PI;

  return {
    longitude: relativeX >= PhotoSphereViewer.PI ? relativeX - PhotoSphereViewer.PI : relativeX + PhotoSphereViewer.PI,
    latitude: PhotoSphereViewer.HalfPI - relativeY
  };
};

/**
 * Converts spherical radians coordinates to pixel texture coordinates
 * @param longitude (double)
 * @param latitude (double)
 * @returns ({x: int, y: int})
 */
PhotoSphereViewer.prototype.sphericalCoordsToTextureCoords = function(longitude, latitude) {
  var relativeLong = longitude / PhotoSphereViewer.TwoPI * this.prop.size.image_width;
  var relativeLat = latitude / PhotoSphereViewer.PI * this.prop.size.image_height;

  return {
    x: parseInt(longitude < PhotoSphereViewer.PI ? relativeLong + this.prop.size.image_width / 2 : relativeLong - this.prop.size.image_width / 2),
    y: parseInt(this.prop.size.image_height / 2 - relativeLat)
  };
};

/**
 * Converts spherical radians coordinates to a THREE.Vector3
 * @param longitude (double)
 * @param latitude (double)
 * @returns (THREE.Vector3)
 */
PhotoSphereViewer.prototype.sphericalCoordsToVector3 = function(longitude, latitude) {
  return new THREE.Vector3(
    -Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.cos(longitude)
  );
};

/**
 * Converts x/y to latitude/longitude if present and ensure boundaries
 * @param position (Object)
 */
PhotoSphereViewer.prototype._cleanPosition = function(position) {
  if (position.hasOwnProperty('x') && position.hasOwnProperty('y')) {
    var sphericalCoords = this.textureCoordsToSphericalCoords(position.x, position.y);
    position.longitude = sphericalCoords.longitude;
    position.latitude = sphericalCoords.latitude;
  }

  position.longitude = position.longitude - Math.floor(position.longitude / PhotoSphereViewer.TwoPI) * PhotoSphereViewer.TwoPI;
  position.latitude = PSVUtils.stayBetween(position.latitude, this.config.tilt_down_max, this.config.tilt_up_max);
};
