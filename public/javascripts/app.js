// Contants

const width = 900;
const height = 600;
const rippleFactor = 0.9;
const angleStep = 5;
const rotationSpeedRad = 0.01;
const frameDelay = 50;
const massRadius = 20;
const gravity = 10;

// Helpers

function r(a) {
  return (a < 0 ? 360 + a : (a >= 360 ? a - 360 : a));
}

function r2(a) {
  return (a < 0 ? 2*Math.PI + a : (a >= 2*Math.PI ? a - 2*Math.PI : a));
}

function cmyk2rgba(c, m, y, k, a) {
  var r, g, b;
  r = 1 - Math.min(1, c * (1 - k) + k);
  g = 1 - Math.min(1, m * (1 - k) + k);
  b = 1 - Math.min(1, y * (1 - k) + k);
  r = Math.round(r * 255);
  g = Math.round(g * 255);
  b = Math.round(b * 255);
  return 'RGBA(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
}

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame     ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

// World

function World(radius, x, y, stamina, color, textSize) {
  this.radius = radius;
  this.x = x;
  this.y = y;
  this.stamina = stamina;
  this.mass = radius * massRadius;
  this.color = color;
  this.font = textSize + 'pt Arial';
  this.queued = [];
  this.makeShape();
  this.rotationRad = 0;
  this.maxRadius = 0;
}

World.prototype.explode = function(a, explsionForce) {
  this.punch(0, r(a - Math.round(this.rotationRad * 180 / Math.PI)), explsionForce);
}

World.prototype.isWithinAtmosphere = function(x, y) {
  return Math.abs(x - this.x) < this.maxRadius && Math.abs(y - this.y) < this.maxRadius;
}

World.prototype.getSurfaceHitInfo = function(x, y) {
  var radius = Math.sqrt(Math.pow(this.x - x, 2) + Math.pow(this.y - y, 2));
  var approachAngle = r(Math.round(Math.atan2(y - this.y, x - this.x) * 180 / Math.PI));
  var spot = this.angleSpotMap[r(approachAngle - Math.round(this.rotationRad * 180 / Math.PI))];
  return {hit: radius < this.radius + spot.d, approachAngle: approachAngle, radius: radius};
}

World.prototype.punch = function(direction, a, force) {
  a = r(a);
  this.angleSpotMap[a].da -= force;
  var self = this;
  this.queue(function() {
    var f = force * rippleFactor;
    if (f < 0.1) return;
    if (direction == -1 || direction == 0) self.punch(-1, a - angleStep, f);
    if (direction == 1 || direction == 0) self.punch(1, a + angleStep, f);
  });
}

World.prototype.makeShape = function() {
  this.shape = [];
  this.angleSpotMap = {};
  for (var i = 0; i < 360; i += angleStep) {
    var a = i / 180 * Math.PI;
    var spot = {x: Math.cos(a) * this.radius, y: Math.sin(a) * this.radius, a: a, d: 0, da: 0};
    this.shape.push(spot);
    // Depends on angleStep
    this.angleSpotMap[r(i - 2)] = spot;
    this.angleSpotMap[r(i - 1)] = spot;
    this.angleSpotMap[r(i)] = spot;
    this.angleSpotMap[r(i + 1)] = spot;
    this.angleSpotMap[r(i + 2)] = spot;
  }
}

World.prototype.queue = function(cb) {
  this.queued.push(cb);
}

World.prototype.tick = function(ctx) {
  // Execute queued functions
  var queued = this.queued;
  this.queued = [];
  for (var i = 0, l = queued.length; i < l; ++i) {
    (queued[i])();
  }

  // Update forces
  this.maxRadius = 0;
  for (var i = 0, l = this.shape.length; i < l; ++i) {
    var spot = this.shape[i];
    spot.d += spot.da;
    spot.da = 0.9 * (spot.da + 0.1 * (0 - spot.d));
    // Update outer radius
    if (this.radius + spot.d > this.maxRadius) this.maxRadius = this.radius + spot.d;
  }

  // Rotation
  this.rotationRad = r2(this.rotationRad + rotationSpeedRad);

  // Redraw world
  ctx.setFillColor(this.color);
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.font = this.font;
  ctx.rotate(this.rotationRad);
  for (var i = 0, l = this.shape.length; i < l; ++i) {
    var spot = this.shape[i];
    spot.d += spot.da;
    var x = spot.x + Math.cos(spot.a) * spot.d;
    var y = spot.y + Math.sin(spot.a) * spot.d;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spot.a);
    ctx.fillText("o", 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return true;
}

// Missile

function Missile(x, y, a, v) {
  this.x = x;
  this.y = y;
  this.vx = Math.cos(a) * v;
  this.vy = Math.sin(a) * v;
  this.blown = false;
}

Missile.prototype.pullBy = function(x, y, m) {
  var dx = x - this.x;
  var dy = y - this.y;
  var d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
  var a = Math.atan2(dy, dx);
  var f = (gravity * m) / Math.pow(d, 2);
  this.vx += Math.cos(a) * f;
  this.vy += Math.sin(a) * f;
}

Missile.prototype.blow = function() {
  this.blown = true;
  this.burning = true;
}

Missile.prototype.tick = function(ctx) {
  if (this.blown) return false;

  // Update force
  this.x += this.vx;
  this.y += this.vy;
  var a = Math.atan2(this.vy, this.vx);

  // Redraw
  ctx.setFillColor('orange');
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(a);
  ctx.textAlign = 'right';
  ctx.fillText('->', 0, 0);
  ctx.restore();
  return true;
}

// Explosion

function Explosion(x, y, a, count) {
  this.x = x;
  this.y = y;
  this.a = a;
  this.particles = [];
  a = a / 180 * Math.PI;
  for (var i = 0; i < count; ++i) {
    this.particles.push({
      x: x,
      y: y,
      a: a + ((Math.PI/2 * Math.random()) - Math.PI/4),
      life: 20
    });
  }
}

Explosion.prototype.tick = function(ctx) {
  var active = 0;
  for (var i = 0, l = this.particles.length; i < l; ++i) {
    var particle = this.particles[i];
    particle.life -= 1;
    if (particle.life <= 0) continue;
    ++active;
    particle.x += Math.cos(particle.a) * 6;
    particle.y += Math.sin(particle.a) * 6;
    ctx.save();
    var intensity = particle.life * 5 / 100;
    var color = cmyk2rgba(0, intensity, 100, 0, intensity);
    ctx.setFillColor(color);
    ctx.translate(particle.x, particle.y);
    ctx.font = Math.round(intensity * 20) + 'pt Arial';
    ctx.fillText('*', 0, 0);
    ctx.restore();
  }
  return active > 0;
}

// Star

function Star(x, y) {
  this.x = x;
  this.y = y;
  this.ticker = 0;
  this.tickerSpeed = Math.random() * 0.1;
  this.intensity = Math.random();
}

Star.prototype.tick = function(ctx) {
  this.ticker += this.tickerSpeed;
  this.intensity = Math.sin(this.ticker);
  ctx.save();
  ctx.setFillColor(cmyk2rgba(0, 0, 0, this.intensity, 1));
  ctx.translate(this.x, this.y);
  ctx.font = '8pt Arial';
  ctx.fillText('*', 0, 0);
  ctx.restore();
  return true;
}

// Game

function Game(ctx) {
  this.ctx = ctx;
  this.things = [];
  this.missiles = [];
}

Game.prototype.start = function(arguments) {
  var self = this;
  function onTick() {
    setTimeout(function() { requestAnimFrame(onTick); }, frameDelay);
    self.tick();
  }
  requestAnimFrame(onTick);
}

Game.prototype.addMissile = function(missile) {
  this.missiles.push(missile);
  this.addBody(missile);
}

Game.prototype.setupWorld = function() {
  for (var i = 0; i < 50; ++i) {
    this.addBody(new Star(Math.random() * width, Math.random() * height));
  }

  this.earth = new World(80, 600, 350, 100, cmyk2rgba(0.5, 0, 1, 0, 1), 8);
  this.addBody(this.earth);

  this.moonOrbitRadius = 300;
  this.moonOrbitAngle = 0;
  this.moonOrbitSpeed = 0.01;
  this.moon = new World(20, 600, 350, 100, 'white', 2);
  this.addBody(this.moon);

  return this.earth;
}

Game.prototype.updateMoon = function() {
  this.moonOrbitAngle = r2(this.moonOrbitAngle + this.moonOrbitSpeed);
  this.moon.x = this.earth.x + Math.cos(this.moonOrbitAngle) * this.moonOrbitRadius;
  this.moon.y = this.earth.y + Math.sin(this.moonOrbitAngle) * this.moonOrbitRadius;
}

Game.prototype.updateMissiles = function() {
  for (var i = 0, l = this.missiles.length; i < l; ++i) {
    var missile = this.missiles[i];
    if (missile.blown) continue;
    missile.pullBy(this.moon.x, this.moon.y, this.moon.mass);
    missile.pullBy(this.earth.x, this.earth.y, this.earth.mass);

    if (this.earth.isWithinAtmosphere(missile.x, missile.y)) {
      var info = this.earth.getSurfaceHitInfo(missile.x, missile.y);
      if (info.hit) {
        missile.blow();
        this.addBody(new Explosion(missile.x, missile.y, info.approachAngle, 20));
        this.earth.explode(info.approachAngle, 10);
      }
    }
    if (this.moon.isWithinAtmosphere(missile.x, missile.y)) {
      var info = this.moon.getSurfaceHitInfo(missile.x, missile.y);
      if (info.hit) {
        missile.blow();
        this.addBody(new Explosion(missile.x, missile.y, info.approachAngle, 10));
        this.moon.explode(info.approachAngle, 5);
      }
    }
  }
}

Game.prototype.addBody = function(thing) {
  this.things.push(thing);
}

Game.prototype.tick = function(arguments) {
  this.ctx.globalAlpha = 0.4;
  this.ctx.setFillColor('#000')
  this.ctx.fillRect(0, 0, width, height);
  this.ctx.globalAlpha = 1;

  this.updateMoon();
  var activeThings = [];
  for (var i = 0, l = this.things.length; i < l; ++i) {
    var thing = this.things[i];
    if (thing.tick(this.ctx) === true) activeThings.push(thing);
  }
  this.things = activeThings;
  this.updateMissiles();
}

// Bootstrap

window.onload = function() {
  var canvas = document.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var game = new Game(ctx);
  var world = game.setupWorld();
  game.start();
  window.onclick = function(e) {
    var x = e.clientX - canvas.offsetLeft;
    var y = e.clientY - canvas.offsetTop;
    var missile = new Missile(x, y, Math.atan2(world.y - y, world.x - x), 5);
    game.addMissile(missile);
  };
}
