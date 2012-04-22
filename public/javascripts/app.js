// Contants

const width = 900;
const height = 600;
const rippleFactor = 0.9;
const angleStep = 5;
const rotationSpeedRad = 0.01;
const frameDelay = 20;
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

window.requestAnimFrame = window.webkitRequestAnimationFrame;

// World

function World(radius, x, y, color, textSize) {
  this.radius = radius;
  this.x = x;
  this.y = y;
  this.static = true;
  this.pullingBodies = [];
  this.mass = radius * massRadius;
  this.color = color;
  this.font = textSize + 'pt Arial';
  this.queued = [];
  this.makeShape();
  this.rotationRad = 0;
  this.maxRadius = 0;
}

World.prototype.pullByMass = function(x, y, m) {
  var dx = x - this.x;
  var dy = y - this.y;
  var d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
  var a = Math.atan2(dy, dx);
  var f = (gravity * m) / Math.pow(d, 2);
  this.vx += Math.cos(a) * f;
  this.vy += Math.sin(a) * f;
}

World.prototype.addPullingBody = function(body) {
  this.pullingBodies.push(body);
}

World.prototype.setVelocity = function(vx, vy) {
  this.static = vx == null;
  this.vx = vx;
  this.vy = vy;
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
    var halfStep = Math.floor(angleStep/2);
    for (var j = i - halfStep; j <= i + halfStep; ++j) {
      this.angleSpotMap[r(j)] = spot;
    }
  }
}

World.prototype.queue = function(cb) {
  this.queued.push(cb);
}

World.prototype.tick = function() {
  // Execute queued functions
  var queued = this.queued;
  this.queued = [];
  for (var i = 0, l = queued.length; i < l; ++i) {
    (queued[i])();
  }

  // Update surface forces
  this.maxRadius = 0;
  for (var i = 0, l = this.shape.length; i < l; ++i) {
    var spot = this.shape[i];
    spot.d += spot.da;
    spot.da = 0.9 * (spot.da + 0.1 * (0 - spot.d));
    if (this.radius + spot.d > this.maxRadius) this.maxRadius = this.radius + spot.d;
  }

  // Pull by external objects
  if (!this.static) {
    for (var i = 0, l = this.pullingBodies.length; i < l; ++i) {
      var body = this.pullingBodies[i];
      this.pullByMass(body.x, body.y, body.mass);
    }
    this.x += this.vx;
    this.y += this.vy;
  }

  // Rotation
  this.rotationRad = r2(this.rotationRad + rotationSpeedRad);

  return true;
}

World.prototype.draw = function(ctx) {
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
}

// Missile

function Missile(x, y, a, v) {
  this.x = x;
  this.y = y;
  this.vx = Math.cos(a) * v;
  this.vy = Math.sin(a) * v;
  this.blown = false;
}

Missile.prototype.pullByMass = function(x, y, m) {
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

Missile.prototype.tick = function() {
  if (this.blown) return false;
  this.x += this.vx;
  this.y += this.vy;
  return true;
}

Missile.prototype.draw = function(ctx) {
  if (this.blown) return;
  ctx.setFillColor('orange');
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(Math.atan2(this.vy, this.vx));
  ctx.textAlign = 'right';
  ctx.fillText('->', 0, 0);
  ctx.restore();
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

Explosion.prototype.tick = function() {
  var active = 0;
  for (var i = 0, l = this.particles.length; i < l; ++i) {
    var particle = this.particles[i];
    particle.life -= 1;
    if (particle.life <= 0) continue;
    ++active;
    particle.x += Math.cos(particle.a) * 6;
    particle.y += Math.sin(particle.a) * 6;
  }
  return active > 0;
}

Explosion.prototype.draw = function(ctx) {
  for (var i = 0, l = this.particles.length; i < l; ++i) {
    var particle = this.particles[i];
    ctx.save();
    var intensity = particle.life * 5 / 100;
    var color = cmyk2rgba(0, intensity, 100, 0, intensity);
    ctx.setFillColor(color);
    ctx.translate(particle.x, particle.y);
    ctx.font = Math.round(intensity * 20) + 'pt Arial';
    ctx.fillText('*', 0, 0);
    ctx.restore();
  }
}

// Star

function Star(x, y) {
  this.x = x;
  this.y = y;
  this.ticker = 0;
  this.tickerSpeed = Math.random() * 0.1;
  this.intensity = Math.random();
}

Star.prototype.tick = function() { return true; }

Star.prototype.draw = function(ctx) {
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
  this.moons = [];
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

Game.prototype.addMoon = function(x, y, vx, vy) {
  var moon = new World(20, x, y, 'white', 2);
  moon.setVelocity(vx, vy);
  moon.addPullingBody(this.earth);
  this.addBody(moon);
  this.moons.push(moon);
}

Game.prototype.setupWorld = function() {
  for (var i = 0; i < 30; ++i) {
    this.addBody(new Star(Math.random() * width, Math.random() * height));
  }

  this.earth = new World(80, 600, 350, cmyk2rgba(0.5, 0, 1, 0, 1), 8);
  this.addBody(this.earth);

  this.addMoon(300, 350, 0, 6);
  this.addMoon(900, 350, 0, -6);
  this.addMoon(600, 650, -6, 0);
  this.addMoon(600, 0, 6, 0);

  return this.earth;
}

Game.prototype.updateMissiles = function() {
  var remainingMissiles = [];
  for (var i = 0, l = this.missiles.length; i < l; ++i) {
    var missile = this.missiles[i];

    missile.pullByMass(this.earth.x, this.earth.y, this.earth.mass);
    for (var j = 0, k = this.moons.length; j < k; ++j) {
      var moon = this.moons[j];
      missile.pullByMass(moon.x, moon.y, moon.mass);
    }

    if (this.earth.isWithinAtmosphere(missile.x, missile.y)) {
      var info = this.earth.getSurfaceHitInfo(missile.x, missile.y);
      if (info.hit) {
        missile.blow();
        this.addBody(new Explosion(missile.x, missile.y, info.approachAngle, 20));
        this.earth.explode(info.approachAngle, 10);
      }
    }
    else {
      for (var j = 0, k = this.moons.length; j < k; ++j) {
        var moon = this.moons[j];
        if (moon.isWithinAtmosphere(missile.x, missile.y)) {
          var info = moon.getSurfaceHitInfo(missile.x, missile.y);
          if (info.hit) {
            missile.blow();
            this.addBody(new Explosion(missile.x, missile.y, info.approachAngle, 10));
            moon.explode(info.approachAngle, 5);
            break;
          }
        }
      }
    }

    if (!missile.blown) remainingMissiles.push(missile);
  }
  this.missiles = remainingMissiles;
}

Game.prototype.addBody = function(thing) {
  this.things.push(thing);
}

Game.prototype.tick = function(arguments) {
  this.ctx.globalAlpha = 0.4;
  this.ctx.setFillColor('#000')
  this.ctx.fillRect(0, 0, width, height);
  this.ctx.globalAlpha = 1;

  var activeThings = [];
  for (var i = 0, l = this.things.length; i < l; ++i) {
    var thing = this.things[i];
    if (thing.tick() === true) {
      thing.draw(this.ctx);
      activeThings.push(thing);
    }
  }
  this.things = activeThings;

  // shouldn't be here
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
