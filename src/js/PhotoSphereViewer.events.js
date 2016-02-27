/**
 * Add all needed event listeners
 */
PhotoSphereViewer.prototype._bindEvents = function() {
  window.addEventListener('resize', this);
  document.addEventListener(PhotoSphereViewer.SYSTEM.fullscreenEvent, this);

  // all interation events are binded to the HUD only
  if (this.config.mousemove) {
    this.hud.container.style.cursor = 'move';
    this.hud.container.addEventListener('mousedown', this);
    this.hud.container.addEventListener('touchstart', this);
    window.addEventListener('mouseup', this);
    window.addEventListener('touchend', this);
    this.hud.container.addEventListener('mousemove', this);
    this.hud.container.addEventListener('touchmove', this);
  }

  if (this.config.mousewheel) {
    this.hud.container.addEventListener(PhotoSphereViewer.SYSTEM.mouseWheelEvent, this);
  }
};

/**
 * Handle events
 * DO NOT RENAME THIS METHOD
 * @param e (Event)
 */
PhotoSphereViewer.prototype.handleEvent = function(e) {
  switch (e.type) {
    // @formatter:off
    case 'resize':      this._onResize();       break;
    case 'mousedown':   this._onMouseDown(e);   break;
    case 'touchstart':  this._onTouchStart(e);  break;
    case 'mouseup':     this._onMouseUp(e);     break;
    case 'touchend':    this._onTouchEnd(e);    break;
    case 'mousemove':   this._onMouseMove(e);   break;
    case 'touchmove':   this._onTouchMove(e);   break;
    case PhotoSphereViewer.SYSTEM.fullscreenEvent:  this._fullscreenToggled();  break;
    case PhotoSphereViewer.SYSTEM.mouseWheelEvent:  this._onMouseWheel(e);      break;
    // @formatter:on
  }
};

/**
 * Resizes the canvas when the window is resized
 */
PhotoSphereViewer.prototype._onResize = function() {
  if (this.container.clientWidth != this.prop.size.width || this.container.clientHeight != this.prop.size.height) {
    this.resize(this.container.clientWidth, this.container.clientHeight);
  }
};

/**
 * The user wants to move
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onMouseDown = function(evt) {
  this._startMove(evt);
};

/**
 * The user wants to move (touch version)
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onTouchStart = function(evt) {
  if (evt.touches.length === 1) {
    this._startMove(evt.touches[0]);
  }
  else if (evt.touches.length === 2) {
    this._startZoom(evt);
  }
};

/**
 * Initializes the movement
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._startMove = function(evt) {
  this.prop.mouse_x = this.prop.start_mouse_x = parseInt(evt.clientX);
  this.prop.mouse_y = this.prop.start_mouse_y = parseInt(evt.clientY);
  this.prop.moving = true;
  this.prop.moved = false;
  this.prop.zooming = false;

  this.stopAutorotate();
  this.stopAnimation();
};

/**
 * Initializes the zoom
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._startZoom = function(evt) {
  var t = [
    { x: parseInt(evt.touches[0].clientX), y: parseInt(evt.touches[0].clientY) },
    { x: parseInt(evt.touches[1].clientX), y: parseInt(evt.touches[1].clientY) }
  ];

  this.prop.pinch_dist = Math.sqrt(Math.pow(t[0].x - t[1].x, 2) + Math.pow(t[0].y - t[1].y, 2));
  this.prop.moving = false;
  this.prop.zooming = true;

  this.stopAutorotate();
  this.stopAnimation();
};

/**
 * The user wants to stop moving
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onMouseUp = function(evt) {
  this._stopMove(evt);
};

/**
 * The user wants to stop moving (touch version)
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onTouchEnd = function(evt) {
  this._stopMove(evt.changedTouches[0]);
};

/**
 * Stops the movement
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._stopMove = function(evt) {
  if (this.prop.moving) {
    if (Math.abs(evt.clientX - this.prop.start_mouse_x) < PhotoSphereViewer.MOVE_THRESHOLD && Math.abs(evt.clientY - this.prop.start_mouse_y) < PhotoSphereViewer.MOVE_THRESHOLD) {
      this._click(evt);
    }
    else {
      this.prop.moved = true;
    }
  }

  this.prop.moving = false;
  this.prop.zooming = false;
};

/**
 * Trigger an event with all coordinates when a simple click is performed
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._click = function(evt) {
  this.trigger('_click', evt);
  if (evt.defaultPrevented) {
    return;
  }

  var data = {
    client_x: parseInt(evt.clientX - this.prop.boundingRect.left),
    client_y: parseInt(evt.clientY - this.prop.boundingRect.top)
  };

  if (evt.data) {
    data = PSVUtils.deepmerge(data, evt.data);
  }

  var screen = new THREE.Vector2(
    2 * data.client_x / this.prop.size.width - 1,
    -2 * data.client_y / this.prop.size.height + 1
  );

  this.raycaster.setFromCamera(screen, this.camera);

  var intersects = this.raycaster.intersectObjects(this.scene.children);

  if (intersects.length === 1) {
    var p = intersects[0].point;
    var phi = Math.acos(p.y / Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z));
    var theta = Math.atan2(p.x, p.z);

    data.longitude = theta < 0 ? -theta : PhotoSphereViewer.TwoPI - theta;
    data.latitude = PhotoSphereViewer.HalfPI - phi;

    var textureCoords = this.sphericalCoordsToTextureCoords(data.longitude, data.latitude);

    data.texture_x = textureCoords.x;
    data.texture_y = textureCoords.y;

    this.trigger('click', data);
  }
};

/**
 * The user moves the image
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onMouseMove = function(evt) {
  evt.preventDefault();
  this._move(evt);
};

/**
 * The user moves the image (touch version)
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onTouchMove = function(evt) {
  if (evt.touches.length === 1) {
    evt.preventDefault();
    this._move(evt.touches[0]);
  }
  else if (evt.touches.length === 2) {
    evt.preventDefault();
    this._zoom(evt);
  }
};

/**
 * Performs movement
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._move = function(evt) {
  if (this.prop.moving) {
    var x = parseInt(evt.clientX);
    var y = parseInt(evt.clientY);

    this.rotate({
      longitude: this.prop.longitude - (x - this.prop.mouse_x) * this.config.long_offset,
      latitude: this.prop.latitude + (y - this.prop.mouse_y) * this.config.lat_offset
    });

    this.prop.mouse_x = x;
    this.prop.mouse_y = y;
  }
};

/**
 * Zoom
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._zoom = function(evt) {
  if (this.prop.zooming) {
    var t = [
      { x: parseInt(evt.touches[0].clientX), y: parseInt(evt.touches[0].clientY) },
      { x: parseInt(evt.touches[1].clientX), y: parseInt(evt.touches[1].clientY) }
    ];

    var p = Math.sqrt(Math.pow(t[0].x - t[1].x, 2) + Math.pow(t[0].y - t[1].y, 2));
    var delta = 80 * (p - this.prop.pinch_dist) / this.prop.size.width;

    this.zoom(this.prop.zoom_lvl + delta);

    this.prop.pinch_dist = p;
  }
};

/**
 * The user wants to zoom (wheel version)
 * @param evt (Event) The event
 */
PhotoSphereViewer.prototype._onMouseWheel = function(evt) {
  evt.preventDefault();
  evt.stopPropagation();

  var delta = evt.deltaY !== undefined ? -evt.deltaY : (evt.wheelDelta !== undefined ? evt.wheelDelta : -evt.detail);

  if (delta !== 0) {
    var direction = parseInt(delta / Math.abs(delta));
    this.zoom(this.prop.zoom_lvl + direction);
  }
};

/**
 * Fullscreen state has changed
 */
PhotoSphereViewer.prototype._fullscreenToggled = function() {
  this.trigger('fullscreen-updated', PSVUtils.isFullscreenEnabled());
};
