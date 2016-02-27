/**
 * Viewer class
 * @param options (Object) Viewer settings
 */
function PhotoSphereViewer(options) {
  if (!(this instanceof PhotoSphereViewer)) {
    return new PhotoSphereViewer(options);
  }

  if (!PhotoSphereViewer.SYSTEM.loaded) {
    PhotoSphereViewer.loadSystem();
  }

  if (!PhotoSphereViewer.SYSTEM.isWebGLSupported && !PSVUtils.checkTHREE('CanvasRenderer', 'Projector')) {
    throw new PSVError('Missing Three.js components: CanvasRenderer, Projector. Get them from threejs-examples package.');
  }

  if (options === undefined || options.panorama === undefined || options.container === undefined) {
    throw new PSVError('No value given for panorama or container.');
  }

  this.config = PSVUtils.deepmerge(PhotoSphereViewer.DEFAULTS, options);

  // normalize config
  this.config.min_fov = PSVUtils.stayBetween(this.config.min_fov, 1, 179);
  this.config.max_fov = PSVUtils.stayBetween(this.config.max_fov, 1, 179);
  this.config.tilt_up_max = PSVUtils.stayBetween(this.config.tilt_up_max, -PhotoSphereViewer.HalfPI, PhotoSphereViewer.HalfPI);
  this.config.tilt_down_max = PSVUtils.stayBetween(this.config.tilt_down_max, -PhotoSphereViewer.HalfPI, PhotoSphereViewer.HalfPI);
  if (this.config.default_fov === null) {
    this.config.default_fov = this.config.max_fov / 2 + this.config.min_fov / 2;
  }
  else {
    this.config.default_fov = PSVUtils.stayBetween(this.config.default_fov, this.config.min_fov, this.config.max_fov);
  }
  if (this.config.anim_lat === null) {
    this.config.anim_lat = this.config.default_lat;
  }
  this.config.anim_lat = PSVUtils.stayBetween(this.config.anim_lat, -PhotoSphereViewer.HalfPI, PhotoSphereViewer.HalfPI);
  if (this.config.caption && !this.config.navbar) {
    this.config.navbar = ['caption'];
  }

  // check config
  if (this.config.max_fov < this.config.min_fov) {
    throw new PSVError('max_fov cannot be lower than min_fov.');
  }

  if (this.config.tilt_up_max < this.config.tilt_down_max) {
    throw new PSVError('tilt_up_max cannot be lower than tilt_down_max.');
  }

  if (this.config.transition && this.config.transition.blur && !PSVUtils.checkTHREE('EffectComposer', 'RenderPass', 'ShaderPass', 'MaskPass', 'CopyShader')) {
    throw new PSVError('Missing Three.js components: EffectComposer, RenderPass, ShaderPass, MaskPass, CopyShader. Get them from threejs-examples package.');
  }

  // references to components
  this.parent = (typeof this.config.container == 'string') ? document.getElementById(this.config.container) : this.config.container;
  this.container = null;
  this.loader = null;
  this.navbar = null;
  this.hud = null;
  this.panel = null;
  this.tooltip = null;
  this.canvas_container = null;
  this.renderer = null;
  this.passes = {};
  this.scene = null;
  this.camera = null;
  this.mesh = null;
  this.raycaster = null;
  this.actions = {};

  // local properties
  this.prop = {
    fps: 60,
    latitude: 0,
    longitude: 0,
    anim_speed: 0,
    zoom_lvl: 0,
    moving: false,
    zooming: false,
    start_mouse_x: 0,
    start_mouse_y: 0,
    mouse_x: 0,
    mouse_y: 0,
    pinch_dist: 0,
    direction: null,
    autorotate_reqid: null,
    animation_promise: null,
    start_timeout: null,
    boundingRect: null,
    size: {
      width: 0,
      height: 0,
      ratio: 0,
      image_width: 0,
      image_height: 0
    }
  };

  // compute zoom level
  this.prop.zoom_lvl = Math.round((this.config.default_fov - this.config.min_fov) / (this.config.max_fov - this.config.min_fov) * 100);
  this.prop.zoom_lvl -= 2 * (this.prop.zoom_lvl - 50);

  // create actual container
  this.container = document.createElement('div');
  this.container.classList.add('psv-container');
  this.parent.appendChild(this.container);

  // is canvas supported?
  if (!PhotoSphereViewer.SYSTEM.isCanvasSupported) {
    this.container.textContent = 'Canvas is not supported, update your browser!';
    throw new PSVError('Canvas is not supported.');
  }

  // init
  this.setAnimSpeed(this.config.anim_speed);

  this.rotate({
    longitude: this.config.default_long,
    latitude: this.config.default_lat
  });

  if (this.config.size !== null) {
    this._setViewerSize(this.config.size);
  }

  if (this.config.autoload) {
    this.load();
  }
}

PhotoSphereViewer.PI = Math.PI;
PhotoSphereViewer.TwoPI = Math.PI * 2.0;
PhotoSphereViewer.HalfPI = Math.PI / 2.0;

PhotoSphereViewer.MOVE_THRESHOLD = 4;

PhotoSphereViewer.ICONS = {};

/**
 * System properties
 */
PhotoSphereViewer.SYSTEM = {
  loaded: false,
  isWebGLSupported: false,
  isCanvasSupported: false,
  maxTextureWidth: 0,
  mouseWheelEvent: null,
  fullscreenEvent: null
};

PhotoSphereViewer.loadSystem = function() {
  var S = PhotoSphereViewer.SYSTEM;
  S.loaded = true;
  S.isWebGLSupported = PSVUtils.isWebGLSupported();
  S.isCanvasSupported = PSVUtils.isCanvasSupported();
  S.maxTextureWidth = PSVUtils.getMaxTextureWidth();
  S.mouseWheelEvent = PSVUtils.mouseWheelEvent();
  S.fullscreenEvent = PSVUtils.fullscreenEvent();
};

/**
 * PhotoSphereViewer defaults
 */
PhotoSphereViewer.DEFAULTS = {
  panorama: null,
  container: null,
  caption: null,
  autoload: true,
  usexmpdata: true,
  min_fov: 30,
  max_fov: 90,
  default_fov: null,
  default_long: 0,
  default_lat: 0,
  tilt_up_max: PhotoSphereViewer.HalfPI,
  tilt_down_max: -PhotoSphereViewer.HalfPI,
  long_offset: Math.PI / 1440.0,
  lat_offset: Math.PI / 720.0,
  time_anim: 2000,
  anim_speed: '2rpm',
  anim_lat: null,
  navbar: [
    'autorotate',
    'zoom',
    'download',
    'markers',
    'caption',
    'fullscreen'
  ],
  tooltip: {
    offset: 5,
    arrow_size: 7,
    delay: 100
  },
  lang: {
    autorotate: 'Automatic rotation',
    zoom: 'Zoom',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    download: 'Download',
    fullscreen: 'Fullscreen',
    markers: 'Markers'
  },
  mousewheel: true,
  mousemove: true,
  click_event_on_marker: true,
  transition: {
    duration: 1500,
    loader: true,
    blur: false
  },
  loading_img: null,
  loading_txt: 'Loading...',
  size: null,
  markers: []
};
