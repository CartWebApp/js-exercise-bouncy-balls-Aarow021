// setup canvas

const canvas = document.querySelector('canvas');
const hiddenCanvas = document.createElement("canvas");
const ctx = hiddenCanvas.getContext("2d");
const visibleCtx = canvas.getContext("2d");
const pageWrapper = document.getElementById('page-wrapper');

let width = canvas.width = hiddenCanvas.width  = pageWrapper.clientWidth;
let height = canvas.height = hiddenCanvas.height = pageWrapper.clientHeight;

let balls = [];
let requestId; //animationRequest
let playing = true; //pause/play
let mouseX = 0;
let mouseY = 0;
let mouse1Down = false;
let mouse2Down = false;
let touchesList = [];
let lastTime = 0;
let deltaTime = 0;
let fps = 0;

//holds all game data (configs, ect)
class Game {
  constructor() {
    //configurable settings
    this.config = {
      //misc
      enableMouse2: true,
      currentMenu: 'general',
      //general
      friction: 0,
      gravityX: 0,
      gravityY: 0,
      collision: true,
      enableAbsorb: false,
      absorbThresh: 0, //min combined velocity to absorb
      wallCollision: true,
      wallCollisionType: 'inner',
      wallDeletesBalls: false,
      wallElasticity: 1,
      //ball generation
      ballGenMinSize: 10,
      ballGenMaxSize: 20,
      ballGenSpeed: 0.5,
      ballGenCount: 100,
      ballColorRandom: true,
      ballColorR: 255,
      ballColorG: 255,
      ballColorB: 255,
      //click abilities
      mouse1: 'push', //command for left click
      mouse2: 'pull', //command for right click
    }

    //holds all the config elements and containers
    //ex: {'split-count': ConfigNumber}
    this.configDOM = {}
    this.mouseAbilities = {}
  }
}

let game = new Game();
let config = game.config;
let configDOM = game.configDOM;
let mouseAbilities = game.mouseAbilities;
let currentSettings = {};
let pushTypes = ['linear', 'constant', 'cross1', 'cross2', 'cross3', 'cross4', 'star', 'dialate', 'misc1', 'misc2'];
let pullTypes = pushTypes;

//debug menu
class Debug {
  constructor() {
    this.queue = ['yoooooo']; //example element would be {'mouseX: 746'}
    this.container = document.getElementById('debug');
    this.output = this.container.querySelector('output');
    this.disabled = true;
    // this.toggle();
  }

  getTouchPositions() {
    for (const touch of touchesList) {
      if (!touch) { continue }
      this.queue.push(`Touch-${touch.id}-X: ${touch.x}`);
      this.queue.push(`Touch-${touch.id}-Y: ${touch.y}`);
    }
  }

  getFPS() {
    fps = Math.round(1000 / deltaTime);
    this.queue.push(fps)
  }

  printQueue() {
    if (!this.disabled) {
      this.output.innerHTML = '';
      for (const line of this.queue) {
        let row = document.createElement('p')
        row.textContent = line;
        this.output.appendChild(row);
      }
      this.queue = [];
    }
  }

  clearQueue() {
    this.queue = [];
  }

  toggle() {
    this.disabled = this.container.classList.toggle('hidden');
  }
}
let debug = new Debug();

//function to generate random number
function random(min, max) {
  const num = Math.floor(Math.random() * (max - min + 1)) + min;
  return num;
}

//waits for a given time
function sleep(ms) {
  return new Promise(rs => {setTimeout(rs, ms)})
}

//hides an element
function hide(element) {
  element.classList.add('hidden');
}

//shows an element
function show(element) {
  element.classList.remove('hidden');
}

//returns the object/value at the end of a key path
//takes in an object and an array of strings(keys)
function searchPath(origin, keys) {
  let currentObject = origin;
  for (let i = 0; i < keys.length; i++) {

      currentObject = currentObject[keys[i]]

  }
  return currentObject;
}

//gives the distance between 2 points
function getDistance([x1, y1], [x2, y2]) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance
}

//calculates the dot product between 2 vectors
function dotProduct(vector1, vector2) {
  return (vector1[0] * vector2[1]) - (vector1[1] * vector2[0])
}

//calculates the angle between 2 points
function getAngle([x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.atan2(dy, dx);
}

//gets the angle of a vector
function vectorAngle([x,y]) {
  return Math.atan2(y, x)
}

//returns x and y components of a magnitude
function getComponents(magnitude, angle) {
  let x = magnitude * Math.cos(angle)
  let y = magnitude * Math.sin(angle)
  return {x, y}
}

//returns the magnitude of a vector
function getMagnitude([x, y]) {
  return Math.sqrt((x*x) + (y*y))
}
//returns the unit of a vector (length of 1)
function unit(vector) {
  if (vector[0] === 0) vector[0] = 1
  if (vector[1] === 0) vector[1] = 1
  let magnitude = getMagnitude(vector);
  let unitX = vector[0] / magnitude;
  let unitY = vector[0] / magnitude;
  return { x: unitX, y: unitY}
}

//gets radius from mass and density
function massToRadius(mass, density) {
  let area = mass / density
  let radius = Math.sqrt(area / Math.PI)
  return radius;
}

//rotates a vector/point about another point by n degrees
function rotateVector(x, y, degrees, center=[0,0]) {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const translatedX = x - center[0];
  const translatedY = y - center[1];
  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;
  const finalX = rotatedX + center[0];
  const finalY = rotatedY + center[1];
  return { x: finalX, y: finalY };
}

class DOMElement {
  constructor(id, tag, requirements, action) {
    this.id = id;
    this.tag = tag ?? 'div';
    this.hidden = false;
    this.element;
    this.parent;
    this.requirements = requirements ?? [];
    this.type;
    this.action = action;
  }

  //generates the innerHTML for the element
  generateInner() {}
  //generates the base element (no innerHTML)
  generateBase() {
    let element = document.createElement(this.tag);
    return element;
  }
  //adds event listeners to the element
  addEventListeners() {}
  //hides the element
  hide() {
    this.element.classList.add('hidden');
  }
  //shows the element
  show() {
    this.element.classList.remove('hidden');
  }
  //hides if any requirement is not met, shows otherwise
  //v = value, o = origin, p = path.
  checkRequirements() {
    for (const requirement of this.requirements) {
      if (!requirement.o2) {
        requirement.o2 = requirement.o;
      }
      if (!requirement.p2) {
        requirement.p2 = requirement.p;
      }
        let n2 = searchPath(requirement.o2, requirement.p2);
        if (searchPath(requirement.o, requirement.p) != requirement.v && n2 != requirement.v) {
          this.hide();
          return;
        }
    }
    this.show();
  }
}

//base class for inputs
class ConfigElement extends DOMElement {
  constructor(id, inputType, displayName, bindedConfig, value, requirements, action) {
    super(id, 'div', requirements, action)
    this.inputType = inputType;
    this.displayName = displayName;
    this.value = value;
    this.hidden = true;
    this.bindedConfig = bindedConfig ?? {parent: config, path: [this.id]};
    this.type = 'input';
    this.element = this.generateBase();
    configDOM[this.id] = this;

  }

  //generates the base element (no innerHTML)
  generateBase() {
    let element = document.createElement('div');
    element.inputType = this.inputType;
    element.classList.add('settings-row');
    element.classList.add('hidden');
    element.classList.add(`${this.inputType}-row`);
    return element;
  }
  addEventListeners() {
    this.element.querySelector('input').addEventListener('input', inputHandler);
  }
  //binds config variable to the element value
  bindConfig(configName) {
    this.bindedConfig.name = configName;
  }
  //changes value and binded setting value
  setValue(newValue, overrideDOM=true) {
    this.value = newValue;
    this.setConfigValue(newValue)
    if (overrideDOM) {
      this.element.querySelector('input').value = this.value;
    }
  }
  //gets the binded config value
  getConfigValue() {
    return searchPath(this.bindedConfig.parent, this.bindedConfig.path);
  }
  //changes the binded configs value
  setConfigValue(value) {
    let copiedPath = [...this.bindedConfig.path];
    let pathHead = copiedPath.pop();
    searchPath(this.bindedConfig.parent, copiedPath)[pathHead] = value;
  }
}

//class for number inputs
class ConfigNumber extends ConfigElement {
  constructor(id, displayName, bindedConfig, value, min, max, step, requirements, action) {
    super(id, 'number', displayName, bindedConfig, value ?? 0, requirements, action);
    this.min = min ?? -Infinity;
    this.max = max ?? -Infinity;
    this.step = step ?? 1;
    this.generateInner();
  }

  generateInner() {
    this.element.innerHTML = `
      <label for="${this.id}-input">${this.displayName}</label>
      <input type="number" id="${this.id}-input" value="${this.value}" min="${this.min}" max="${this.max}" step="${this.step}">`
  }

  setValue(newValue, overrideDOM=true) {
    this.value = newValue;
    this.setConfigValue(Number(newValue));
    if (overrideDOM) {
      this.element.querySelector('input').value = this.value;
    }
  }
}

//class for number inputs
class ConfigSlider extends ConfigElement {
  constructor(id, displayName, bindedConfig, value, min, max, step, sliderMin, sliderMax, sliderStep, requirements, action) {
    super(id, 'slider', displayName, bindedConfig, value ?? 0, requirements, action);
    this.min = min ?? -Infinity;
    this.max = max ?? -Infinity;
    this.step = step ?? 1;
    this.sliderMin = sliderMin ?? this.min;
    this.sliderMax = sliderMax ?? this.max;
    this.sliderStep = sliderStep ?? this.step;
    this.generateInner();
  }

  generateInner() {
    this.element.innerHTML = `
      <label for="${this.id}-input">${this.displayName}</label>
      <div class="slider-container">
        <input type="number" id="${this.id}-input" value="${this.value}" min="${this.min}" max="${this.max}" step="${this.step}">
        <input type="range" id="${this.id}-input-slider" value="${this.value}" min="${this.sliderMin}" max="${this.sliderMax}" step="${this.sliderStep}">
      </div>`
  } 

  addEventListeners() {
    const numInput = this.element.querySelector('input[type=number]');
    const slider = this.element.querySelector('input[type=range]');
    numInput.addEventListener('input', (e) => {
      slider.value = numInput.value;
      inputHandler(e);
    })
    slider.addEventListener('input', (e) => {
      numInput.value = slider.value;
      inputHandler(e);
    })
  }

  setValue(newValue, overrideDOM=true) {
    this.value = newValue;
    this.setConfigValue(Number(newValue));
    if (overrideDOM) {
      this.element.querySelectorAll('input').forEach((input => {
        input.value = this.value;
      }))
    }
  }
}

//class for number inputs
class ConfigCheckbox extends ConfigElement {
  constructor(id, displayName, bindedConfig, value, requirements, action) {
    super(id, 'checkbox', displayName, bindedConfig, value ?? 0, requirements, action);
    this.generateInner();
  }

  generateInner() {
    this.element.innerHTML = `
      <label for="${this.id}-input">${this.displayName}</label>
      <div class="checkbox-container">
        <input type="checkbox" id="${this.id}-input">
        <span class="checkmark"></span>
      </div>`;
    this.element.querySelector("input[type=checkbox]").checked = this.value;
  }

  addEventListeners() {
    this.element.querySelector('input').addEventListener('input', inputHandler);
  }

  setValue(newValue, overrideDOM=true) {
    this.value = newValue;
    this.setConfigValue(newValue);
    if (overrideDOM) {
      this.element.querySelector('input').checked = newValue;
    }
  }
}

//class for number inputs
class ConfigDropdown extends ConfigElement {
  constructor(id, displayName, bindedConfig, value, options, requirements, action) {
    super(id, 'dropdown', displayName, bindedConfig, value ?? 0, requirements, action);
    this.options = options;
    this.generateInner();
  }

  generateInner() {
    let optionsHTML = '';
    for (const option of this.options) {
      optionsHTML += `<option value="${option}">${option}</option>`
    }
    this.element.innerHTML = `
      <label for="${this.id}-input">${this.displayName}</label>
      <select id="${this.id}-input">${optionsHTML}</select>`
  }

  addEventListeners() {
    this.element.querySelector('select').addEventListener('input', inputHandler);
  }

  setValue(newValue, overrideDOM=true) {
    this.value = newValue;
    this.setConfigValue(newValue);
    if (overrideDOM) {
      this.element.querySelector('select').value = newValue;
    }
  }
}

//container for config
class Container extends DOMElement {
  constructor(id, displayName, children, requirements, action) {
    super(id, 'div', requirements, action);
    this.type = 'container';
    this.displayName = displayName ?? '';
    this.children = children ?? [];
    this.layer = -1;
    this.element = this.generateBase();
    this.generateInner();
    for (const child of this.children) {
      this.bindChild(child)
    }
    configDOM[this.id] = this;
  }

  generateBase() {
    let element = document.createElement('div');
    element.type = this.type;
    element.id = `${this.id}-section`;
    element.classList.add('settings-section');
    element.classList.add('hidden');
    return element;
  }

  generateInner() {
    this.element.innerHTML = `<h3>${this.displayName}</h3>`
  }

  //adds child to element
  bindChild(child) {
    if (child.parent && child.parent != this) {
      child.parent.removeChild(child);
    }
    this.element.appendChild(child.element);
    child.parent = this;
    child.layer = this.layer + 1;
  }

  //adds child to object and binds
  addChild(newChild) {
    this.children.push(newChild);
    this.bindChild(newChild);
  }

  //removes child from element and object
  removeChild(child) {
    this.element.querySelector(`.settings-row:has(#${child.id}-input)`).remove();
    this.children.splice(this.children.indexOf(child), 1);
  }

  addEventListeners() {
    for (const child of this.children) {
      child.addEventListeners();
    }
  }
}

//class for main categories
class MainContainer extends Container {
  constructor(id, displayName, children, requirements) {
    super(id, displayName, children, requirements);
    this.layer = 1;
  }

  generateBase() {
    let element = document.createElement('div');
    element.type = this.type;
    element.id = `${this.id}-section`;
    element.classList.add('settings-section-main');
    element.classList.add('hidden');
    return element;
  }
  generateInner() {
    this.element.innerHTML = `<h2>${this.displayName}</h2>`
  }
}

class LayoutContainer extends Container {
  constructor(id, children, requirements) {
    super(id, '', children, requirements);
  }

  generateBase() {
    let element = document.createElement('div');
    element.type = this.type;
    element.id = `${this.id}-section-layout`;
    element.classList.add('settings-layout');
    element.classList.add('hidden');
    return element;
  }

  generateInner() {
    this.element.innerHTML = ``;
  }

  //adds child to element
  bindChild(child) {
    if (child.parent && child.parent != this) {
      child.parent.removeChild(child);
    }
    this.element.appendChild(child.element);
    child.parent = this;
    child.layer = this.layer;
  }
}

//base class for abilities
class Ability {
  constructor(name, repeats, interval, radius, strength, count, color, colorRandom, ...params) {
    this.name = name;
    this.repeats = repeats;
    this.interval = interval ?? 20;
    this.radius = radius ?? 0;
    this.strength = strength ?? 1;
    this.count = count ?? Infinity;
    this.color = color ?? {r: 255, g: 255, b: 255};
    this.colorRandom = colorRandom ?? false; //default or random
    this.params = params ?? []
    for (const param of this.params) {
      this[param.name] = param.value;
    }
  }
}

class MouseAbility extends Ability {
  constructor(name, repeats, interval, radius, strength, count, color, colorRandom, ...params) {
    super(name, repeats, interval, radius, strength, count, color, colorRandom, ...params)
  }
}


//ball class
class Ball {
  constructor(x, y, velX, velY, [r, g, b], radius, mass) {
    this.x = x;
    this.y = y;
    this.velX = velX;
    this.velY = velY;
    this.r = r;
    this.g = g;
    this.b = b;
    this.radius = radius;
    this.mass = mass || this.getArea();
    this.density = this.getArea() / this.mass;
    this.momentumX = this.mass * velX;
    this.momentumY = this.mass * velY;
    this.calcVelocity();
    this.calcRadius();
    this.isColliding = false;
  }

  //draws
  draw() {
    ctx.beginPath();
    ctx.fillStyle = `rgb(${~~this.r}, ${~~this.g}, ${~~this.b}`;
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  //gets area of ball
  getArea() {
    return Math.PI * this.radius ** 2
  }

  //deletes this object
  delete() {
    balls.splice(balls.indexOf(this), 1);
  }

  //sets the velocity of ball
  setVelocity(x, y) {
    this.velX = x;
    this.velY = y;
    this.momentumX = x * this.mass;
    this.momentumY = y * this.mass;
  }

  //a = pi * r^2
  //r = sqrt(a / pi)
  calcRadius() {
    let area = this.mass / this.density
    this.radius = Math.sqrt(area / Math.PI)
  }

  //v = momentum / mass
  calcVelocity() {
    this.velX = this.momentumX / this.mass;
    this.velY = this.momentumY / this.mass;
  }

  //returns whether the ball is in another ball and rebounding (not working)
  isRebounding(ball2) {
    let dx = this.x - ball2.x;
    let dy = this.y - ball2.y;
    let dsq = dx*dx + dy*dy; //square of distance between circles
  
    let dv = 2*(this.velX*dx + this.velY*dy)/dsq; //velocity change factor
    let isRebounding = (dv > 0);

    return isRebounding;
  }

  //gets the resulting velocity of an elastic collision
  //got equation from https://en.wikipedia.org/wiki/Elastic_collision#Two-dimensional_collision_with_two_moving_objects 
  getCollisionVector(ball2) {
    const v1 = getMagnitude([this.velX, this.velY]),
          v2 = getMagnitude([ball2.velX, ball2.velY]),
          angle1 = vectorAngle([this.velX, this.velY]),
          angle2 = vectorAngle([ball2.velX, ball2.velY]),
          m1 = this.mass,
          m2 = ball2.mass,
          cA = getAngle([this.x, this.y], [ball2.x, ball2.y]) //contact angle

    const part1 = (v1 * Math.cos(angle1 - cA) * (m1 - m2) + 2 * m2 * v2 * Math.cos(angle2 - cA)) / (m1 + m2);
    const vx = part1 * Math.cos(cA) + v1 * Math.sin(angle1 - cA) * Math.cos(cA + Math.PI/2);
    const vy = part1 * Math.sin(cA) + v1 * Math.sin(angle1 - cA) * Math.sin(cA + Math.PI/2);
    return {x: vx, y: vy};
  }

  //fuses this ball with another. The largest one is kept
  fuse(ball2) {
    let biggerBall = ball2.mass > this.mass ? ball2 : this;
    let smallerBall = ball2.mass <= this.mass ? ball2 : this;
    let massRatio = smallerBall.mass / biggerBall.mass;
    //color
    if (config.ballColorRandom) {
      biggerBall.r = ((biggerBall.r + smallerBall.r) / 2 + random(0, 255) * 2) / 3;
      biggerBall.g = ((biggerBall.g + smallerBall.g) / 2  + random(0, 255) * 2) / 3;
      biggerBall.b = ((biggerBall.b + smallerBall.b) / 2  + random(0, 255) * 2) / 3;
    } else {
      biggerBall.r = (biggerBall.r + smallerBall.r * massRatio) / (1 + massRatio);
      biggerBall.g = (biggerBall.g + smallerBall.g * massRatio) / (1 + massRatio);
      biggerBall.b = (biggerBall.b + smallerBall.b * massRatio) / (1 + massRatio);
    }
    //momentum
    biggerBall.momentumX += smallerBall.momentumX;
    biggerBall.momentumY += smallerBall.momentumY;
    //mass
    biggerBall.mass += smallerBall.mass;

    //Calculates new velocity and radius from new mass and momentum
    biggerBall.calcVelocity();
    biggerBall.calcRadius();

    //removes the smaller ball
    balls.splice(balls.indexOf(smallerBall), 1);
  }

  //does elastic collision with other ball
  bounce(ball2) {
    let newVectors = {ball1: this.getCollisionVector(ball2), ball2: ball2.getCollisionVector(this)};

    this.setVelocity(newVectors.ball1.x, newVectors.ball1.y);
    ball2.setVelocity(newVectors.ball2.x, newVectors.ball2.y);
    this.unstick(ball2);
  }

  //seperates balls so they don't orbit
  unstick(ball2) {
    let angle = getAngle([this.x, this.y], [ball2.x, ball2.y]);
    let distance = getDistance([this.x, this.y], [ball2.x, ball2.y]);
    let minDistance = this.radius + ball2.radius;
    let spread = minDistance - distance;
    let ax = spread * Math.cos(angle);
    let ay = spread * Math.sin(angle);
    this.x -= ax;
    this.y -= ay;
    ball2.x += ax;
    ball2.y += ay
  }

  //handles ball collision checking and actions
  collisionDetect() {
    if (!config.collision) { return }
    for (let j = 0; j < balls.length; j++) {
      if (this === balls[j]) { continue };
      const distance = getDistance([this.x, this.y], [balls[j].x, balls[j].y]);
      //collision condition
      if (distance < this.radius + balls[j].radius && !this.isRebounding(balls[j])) {
        //If the velocity between the two are great enough
        if (config.enableAbsorb && Math.abs((this.velX - balls[j].velX) + (this.velY - balls[j].velY)) > config.absorbThresh) {
          this.fuse(balls[j])
        } else {
          this.bounce(balls[j])
        }
      }
    }
  }

  //calculates balls next position/vectors
  update() {
    if (config.wallCollision) {
      let collided = false;
      let offset;
      let wallElasticity = config.wallElasticity;
      if (config.wallCollisionType === 'inner') ( offset = this.radius )
      else if (config.wallCollisionType === 'center') ( offset = 0 )
      else if (config.wallCollisionType === 'outer') ( offset = -this.radius )

      if ((this.x + offset) >= width) {
        this.momentumX = -(this.momentumX) * wallElasticity;
        this.x = width - offset;
        collided = true;
      }
  
      if ((this.x - offset) <= 0) {
        this.momentumX = -(this.momentumX) * wallElasticity;
        this.x = 0 + offset;
        collided = true;
      }
  
      if ((this.y + offset) >= height) {
        this.momentumY = -(this.momentumY) * wallElasticity;
        this.y = height - offset;
        collided = true;
      }
  
      if ((this.y - offset) <= 0) {
        this.momentumY = -(this.momentumY) * wallElasticity;
        this.y = 0 + offset;
        collided = true;
      }
      if (config.wallDeletesBalls && collided) {
        this.delete();
        return;
      }
    }

    this.calcVelocity();
    let friction = config.friction;
    this.momentumX *= 1 - friction;
    this.momentumY *= 1 - friction;
    this.momentumX += config.gravityX * this.mass;
    this.momentumY += config.gravityY * this.mass;

    this.calcVelocity();
    if (Math.abs(this.velX) < .01 && friction > 0) {
      this.momentumX = 0;
    }
    if (Math.abs(this.velY) < .01 && friction > 0) {
      this.momentumY = 0;
    }

    this.x += this.velX;
    this.y += this.velY;

    if (isNaN(this.x) || isNaN(this.y)) {
      this.delete();
    }
  }
  
  //splits a ball into 2 or more
  split(splits, splitSpeed=1) {
    let randomDeg = random(0, 360);
    for (let i = 0; i < splits; i++) {
      let newVelocity = rotateVector(
        1 * splitSpeed,
        1 * splitSpeed,
        360 / splits * i + randomDeg
      )
      let newSize = massToRadius(this.mass / splits, this.density);
      addBalls(
        1,
        newSize,
        this.x,
        this.y,
        null,
        newVelocity.x,
        newVelocity.y
      );
    }
    balls.splice(balls.indexOf(this), 1);
  }
}

//main animation loop
function loop(currentTime) {
  deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < balls.length; i++) {
    balls[i]?.update();
    balls[i]?.collisionDetect();
    balls[i]?.draw();
    
  }

  visibleCtx.drawImage(hiddenCanvas, 0, 0);

  requestId = requestAnimationFrame(loop);

  // debug.getTouchPositions();
  debug.getFPS();
  debug.printQueue();
}

//converts a string of the form 'rgb(0,0,0) 
//into an array [r, g, b]'
function rgbStringToObject(str) {
  const startIndex = str.indexOf('(') + 1;
  const endIndex = str.indexOf(')');
  const rgbValues = str.substring(startIndex, endIndex).split(',').map(Number);
  return rgbValues;
}

//generates color based on config settings
function generateColor(source='generated', ability=null) {
  if (source === 'generated') {
    if (config.ballColorRandom) {
      return [random(0,255), random(0,255), random(0,255)]
    } else {
      return [config.ballColorR, config.ballColorG, config.ballColorB];
    }
  } else if (source === 'ability') {
    if (ability.colorRandom === true) {
      return [random(0,255), random(0,255), random(0,255)]
    } else {
      return [ability.color.r, ability.color.g, ability.color.b];
    }
  }
}

//populates screen with balls
function addBalls(num, size, x, y, speed, vx, vy, color) {
  for (let i = 0; i < num; i++) {
    let radius = size || random(config.ballGenMinSize, config.ballGenMaxSize);
    let newSpeed = speed ?? config.ballGenSpeed;
    let ball = new Ball(
      // ball position always drawn at least one ball width
      // away from the edge of the canvas, to avoid drawing errors
      x ?? random(0 + radius,width - radius),
      y ?? random(0 + radius,height - radius),
      vx ?? random(-newSpeed * 100,newSpeed * 100) / 100,
      vy ?? random(-newSpeed * 100,newSpeed * 100) / 100,
      color ?? generateColor(),
      radius
    );
  
    balls.push(ball);
  }    
}

//pauses the animation
function stopCanvas() {
  playing = false;
  cancelAnimationFrame(requestId);
}

//resumes animation
function startCanvas() {
  if (playing) { return }
  playing = true;
  requestAnimationFrame(loop);
}

//toggles a settings menu main section
function selectSection(category, containerID='settings-nav') {
  let container = document.getElementById(containerID);
  let buttonID = category + '-toggle';
  for (let button of container.querySelectorAll('button')) {
    if (button.id != buttonID) {
      button.classList.remove('active');
    } else {
      button.classList.add('active');
    }
  }
  config.currentMenu = category;
  updateMenu();
}

//handles every button press
function buttonHandler(e) {
  const btn = e.target;
  const id = btn.id;
  if (id === 'menu-toggle') {
    btn.classList.toggle('active')
  } else if (id === 'pause') {
    stopCanvas();
  } else if (id === 'play') {
    startCanvas();
  } else if (id === 'reset') {
    balls = [];
    addBalls(config.ballGenCount);
  } else if (id === 'settings-toggle') {
    document.getElementById('settings').classList.toggle('hidden');
  } else if (id === 'settings-close') {
    document.getElementById('settings').classList.add('hidden');
  } else if (btn.parentElement.parentElement.classList.contains('nav')) {
    selectSection(btn.id.substring(0, btn.id.indexOf('-')));
  }
  if (btn.classList.contains('test-icon')) {
    btn.classList.add('active')
  }
}

//updates the elements in menu; some may need to be hidden, others shown
function updateMenu() {
  for (const config of Object.values(configDOM)) {
    config.checkRequirements();
  }
}

//sets variables to values of inputs
function inputHandler(e) {
  let id = e.target.id;
  let value;
  if (e.target.type === 'checkbox') {
    value = e.target.checked;
  } else {
    value = e.target.value;
  }
  let input = configDOM[id.substring(0, id.indexOf('-'))]
  input.setValue(value, false);
  if (input.action) {
    input.action(input);
  }
  updateMenu()
}

//does an action to every ball that meets a given condition
function checkAllCollisions(x, y, radius, maxCollisions, action, condition) {
  if (!condition) {
    condition = (ball, dist) => dist < ball.radius + radius;
  }
  let collisionCount = 0;
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([x, y], [balls[j].x, balls[j].y])
    if (condition(balls[j], distance)) {
      action(balls[j], distance);
      collisionCount++;
      if (maxCollisions && collisionCount >= maxCollisions) {
        return;
      }
    }
  }
}

//deletes balls within a radius
function deleteBalls(x, y, radius) {
  checkAllCollisions(x, y, radius, null, (ball) => {
    balls.splice(balls.indexOf(ball), 1);
    }, (ball, dist) => dist < ball.radius + radius)
}

//colors balls within a radius
function colorBalls(x, y, radius, [r, g, b]) {
  checkAllCollisions(x, y, radius, null, (ball) => {
    ball.r = r;
    ball.g = g;
    ball.b = b;
    }, (ball, dist) => dist < ball.radius + radius)
}

//adds to velocity of an object
function applyForce(object, forceX, forceY) {
  object.setVelocity(object.velX - forceX, object.velY - forceY)
}

//applies a force to a ball based on its distance to a point
function generateForce(ball, type, direction, dist, x, y, strength) {
  let forceX, forceY;
    let xSign = (x - ball.x > 0) ? 1: -1;
    let ySign = (y - ball.y > 0) ? 1: -1;
    dist = dist || 10e-20

    if (type === 'star') {
      forceX = (strength * 200) / (x - ball.x) / (dist * dist);
      forceY = (strength * 200) / (y - ball.y) / (dist * dist);
    } else if (type === 'linear') {
      forceX = (strength / 1000) * (x - ball.x);
      forceY = (strength / 1000) * (y - ball.y);
    } else if (type === 'constant') {
      forceX = (strength / 10) * (x - ball.x) / dist;
      forceY = (strength / 10) * (y - ball.y) / dist;
    } else if (type === 'cross1') {
      forceX = (strength / 2) / (x - ball.x);
      forceY = (strength / 2) / (y - ball.y);
    } else if (type === 'cross2') {
      forceX = (strength / 50) * Math.log10(dist) * xSign;
      forceY = (strength / 50) * Math.log10(dist) * ySign;
    } else if(type === 'cross3') {
      forceX = (strength / 150) / (x - ball.x) * dist;
      forceY = (strength / 150) / (y - ball.y) * dist;
    } else if (type === 'cross4') {
      forceX = (strength * 30) / (x - ball.x) / dist;
      forceY = (strength * 30) / (y - ball.y) / dist;
    } else if (type === 'dialate') {
      forceX = (strength / 100000) * (x - ball.x) * dist;
      forceY = (strength / 100000) * (y - ball.y) * dist;
    } else if (type === 'misc1') {
      forceX = (strength / 500) * (x - ball.x) * (x - ball.x) / dist * xSign;
      forceY = (strength / 500) * (y - ball.y) * (y - ball.y) / dist * ySign;
    } else if (type === 'misc2') {
      forceX = (x - ball.x);
      forceY = (y - ball.y);
      let norm = unit([forceX, forceY]);
      forceX = norm.x * xSign * (strength / 8)
      forceY = norm.y * ySign * (strength / 8)
    }

    if (direction === 'pull') {
      forceX = -forceX;
      forceY = -forceY;
    }

    applyForce(ball, forceX, forceY);
}

//applies force to all balls in/out a radius
function forceBalls(x, y, radius, strength, direction, type='linear', mode='default', condition=()=>true) {
  if (direction === 'push' && mode === 'default') {
    checkAllCollisions(x, y, radius, null, (ball, dist) => {
      generateForce(ball, type, direction, dist, x, y, strength)
    }, (ball, dist) => dist < ball.radius + radius && condition())
  } else if (direction === 'push' && mode === 'inverted') {
    checkAllCollisions(x, y, radius, null, (ball, dist) => {
      generateForce(ball, type, direction, dist, x, y, strength)
    }, (ball, dist) => dist > ball.radius + radius && condition())
  } else if (direction === 'pull' && mode === 'default') {
    checkAllCollisions(x, y, radius, null, (ball, dist) => {
      generateForce(ball, type, direction, dist, x, y, strength)
    }, (ball, dist) => dist < ball.radius + radius && condition())
  } else if (direction === 'pull' && mode === 'inverted') {
    checkAllCollisions(x, y, radius, null, (ball, dist) => {
      generateForce(ball, type, direction, dist, x, y, strength)
    }, (ball, dist) => dist > ball.radius + radius && condition())
  }
}

//attracts balls to a point
function pullBalls(x, y, radius, strength, type, mode) {
  forceBalls(x, y, radius, strength, 'pull', type, mode);
}

//pushes balls away from a point
function pushBalls(x, y, radius, strength, type, mode) {
  forceBalls(x, y, radius, strength, 'push', type, mode);
}

//uses an ability at a coordinate
function useAbility(ability, [x, y]) {
  if (ability.name === 'generate') {
    addBalls(ability.count, null, x, y, ability.strength)
  } else if (ability.name === 'delete') {
    deleteBalls(x, y, ability.radius);
  } else if (ability.name === 'split') {
    checkAllCollisions(x, y, 1, 1, (ball) => {
      ball.split(ability.count, ability.strength);
    }, (ball, dist) => dist < ball.radius + ability.radius) 
  } else if (ability.name === 'push') {
    pushBalls(x, y, ability.radius, ability.strength, ability.type, ability.mode);
  } else if (ability.name === 'pull') {
    pullBalls(x, y, ability.radius, ability.strength, ability.type, ability.mode);
  } else if (ability.name === 'color') {
    colorBalls(x, y, ability.radius, generateColor('ability', ability));
  } 
}

//repeats an ability at a given interval until the condition is not met.
//the x and y positions are dynamically generated by the coordGetter function
async function repeatAbility(ability, coordGetter, condition) {
  if (!condition) {
    condition = () => false;
  }
  do {
    useAbility(ability, coordGetter())
    await sleep(ability.interval || 1);
  } while(condition()) ;
}

//gets the coordinates of a touch
function getTouchCoords(id) {
  if (!touchesList[id]) {return false}
    return [touchesList[id].x, touchesList[id].y]
}

//handles what happens when the canvas is clicked
function clickHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  let ability;
  let isMouseDown;

  if (e.button === 0) { //left mouse
    ability = mouseAbilities[config.mouse1];
    mouse1Down = true;
    isMouseDown = () => mouse1Down;
  } else if (e.button === 2) { //right mouse
    ability = mouseAbilities[config.mouse2];
    mouse2Down = true;
    isMouseDown = () => mouse2Down;
  }

  if (ability.repeats) {
    repeatAbility(ability, ()=>[mouseX, mouseY], isMouseDown);
  } else {
    useAbility(ability, [mouseX, mouseY]);
  }
}

//what happens when the canvas is tapped (touchscreen, multitouch)
function touchHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  let ability = mouseAbilities[config.mouse1];
  let touches = e.targetTouches;
  for (const touch of touches) {
    let id = touch.identifier
    touchesList[id] = {id: id, x: touch.clientX, y: touch.clientY, timeoutId: setTimeout(() => {/*delete touchesList[id]*/}, 15000)}
  
    if (ability.repeats) {
      repeatAbility(ability.name, ability.interval, ()=>getTouchCoords(id), ()=>touchesList[id]);
    } else {
      useAbility(ability.name, [touch.clientX, touch.clientY])
    }
  }
}

//what happens when the touch moves
function touchMoveHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  let touches = e.changedTouches;
  for (const touch of touches) {
    let id = touch.identifier;
    // if (!TouchList[id]) { continue }
    clearTimeout(touchesList[id].timeoutId);
    touchesList[id].x = touch.clientX;
    touchesList[id].y = touch.clientY;
    touchesList[id].timeoutId = setTimeout(() => {delete touchesList[identifier]}, 10000);
  }
}

//what happens when the touch ends
function touchEndHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  let touches = e.changedTouches;
  for (const touch of touches) {
    let id = touch.identifier;
    delete touchesList[id];
  }
}

//what happens when the touch is canceled
function touchCancelHandler(e) {
  e.preventDefault();
  let id = e.touch.identifier;
  delete touchesList[id];
}

//handles keypresses
function keyHandler(e) {
  let key = e.key;
  if (key === 'F9') {
    debug.toggle();
  }
}

//makes mouse abilities mutually exclusive
function checkMouseValues(mouse) {
  // let primary = mouse?.id ?? 'mouse1';
  // if (primary === 'mouse1' && config.mouse2 === config.mouse1 && config.mouse2 != 'none') {
  //   configDOM.mouse2.setValue('none');
  // } else if (config.mouse1 === config.mouse2 && config.mouse1 != 'none') {
  //   configDOM.mouse1.setValue('none');
  // }
}

//sets up the event listeners
function addEventListeners() {

  //adds button handler to each button
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', buttonHandler);
  })
  
  //enables canvas to respond to screen size changes
  window.addEventListener('resize', () => {
    width = canvas.width = hiddenCanvas.width = pageWrapper.clientWidth;
    height = canvas.height = hiddenCanvas.height = pageWrapper.clientHeight;
  })
  
  //adds click events
  canvas.addEventListener('mousedown', clickHandler);
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {mouse1Down = false}
    else if (e.button === 2) {mouse2Down = false}
  });

  //add touch events
  canvas.addEventListener('touchstart', touchHandler);
  canvas.addEventListener('touchend', touchEndHandler);
  canvas.addEventListener('touchcancel', touchCancelHandler);
  canvas.addEventListener('touchmove', touchMoveHandler);


  //disables right-click menu on canvas
  canvas.addEventListener("contextmenu", e => {
    e.preventDefault();
  }, false);

  //keypress events
  window.addEventListener('keyup', keyHandler)
}

//generates ability settings
function initAbilities() {
  mouseAbilities.none = new MouseAbility('none', false);
  mouseAbilities.push = new MouseAbility('push', true, null, 150, 1, null, null, null, {name: 'mode', value: 'default'}, {name: 'type', value: 'linear'});
  mouseAbilities.pull = new MouseAbility('pull', true, null, 150, 1, null, null, null, {name: 'mode', value: 'default'}, {name: 'type', value: 'linear'});
  mouseAbilities.split = new MouseAbility('split', false, null, null, null, 2);
  mouseAbilities.generate = new MouseAbility('generate', false, null, null, 1, 1);
  mouseAbilities.delete = new MouseAbility('delete', true, 5, 10);
  mouseAbilities.color = new MouseAbility('color', true, null, 10, null, null, {r: 255, g: 255, b: 255}, false);
}

//sets whether an ability repeats
function setAbilityRepeat(ability) {
  ability
}

//creates input objects and populates settings menu 
function initInputs() {
  //GENERAL
  const general = new MainContainer('general', 'General', null, [{o: config, p: ['currentMenu'], v: 'general'}]);
  general.addChild(new ConfigSlider('gravityY', 'Gravity-Y', null, 0, -Infinity, Infinity, .001, -1, 1, .02));
  general.addChild(new ConfigSlider('gravityX', 'Gravity-X', null, 0, -Infinity, Infinity, .001, -1, 1, .02));
  general.addChild(new ConfigSlider('friction', 'Friction', null, 0, -Infinity, Infinity, .0001, 0, 1, .001));
  general.addChild(new ConfigCheckbox('collision', 'Collision', null, true));
  general.addChild(new ConfigCheckbox('enableAbsorb', 'Absorb', null, false, [{o: config, p: ['collision'], v: true}]));
  general.addChild(new ConfigNumber('absorbThresh', 'Absorb Resistance', null, 0, 0, Infinity, 1, [{o: config, p: ['enableAbsorb'], v: true}]));
    //-walls
  const wallContainer = new Container('wallContainer', 'Walls');
  wallContainer.addChild(new ConfigCheckbox('wallCollision', 'Wall Collision', null, true));
  wallContainer.addChild(new ConfigDropdown('wallCollisionType', 'Collision Type', null, 'inner', ['inner', 'center', 'outer'], [{o: config, p: ['wallCollision'], v: true}]));
  wallContainer.addChild(new ConfigCheckbox('wallDeletesBalls', 'Deletes Balls', null, false, [{o: config, p: ['wallCollision'], v: true}]));
  wallContainer.addChild(new ConfigSlider('wallElasticity', 'Elasticity', null, 1, 0, Infinity, .01, 0, 1, .01, [{o: config, p: ['wallCollision'], v: true}, {o: config,p: ['wallDeletesBalls'], v: false}]));
  general.addChild(wallContainer);
  //GENERATION
  const generation = new MainContainer('ballGeneration', 'Ball Generation', null, [{o: config, p: ['currentMenu'], v: 'generation'}]);
  generation.addChild(new ConfigNumber('ballGenCount', 'Count', null, 100, 0, Infinity, 1));
  generation.addChild(new ConfigNumber('ballGenMinSize', 'Min Size', null, 10, 0, Infinity, 1));
  generation.addChild(new ConfigNumber('ballGenMaxSize', 'Max Size', null, 20, 0, Infinity, 1));
  generation.addChild(new ConfigNumber('ballGenSpeed', 'Speed', null, 0.5, 0, Infinity, .01));
    //-color
  const ballColorContainer = new Container('ballColorContainer', 'Color');
  ballColorContainer.addChild(new ConfigCheckbox('ballColorRandom', 'Random Color', null, true));
  ballColorContainer.addChild(new ConfigSlider('ballColorR', 'R', null, 255, 0, 255, 1, null, null, null, [{o: config, p: ['ballColorRandom'], v: false}]));
  ballColorContainer.addChild(new ConfigSlider('ballColorG', 'G', null, 255, 0, 255, 1, null, null, null, [{o: config, p: ['ballColorRandom'], v: false}]));
  ballColorContainer.addChild(new ConfigSlider('ballColorB', 'B', null, 255, 0, 255, 1, null, null, null, [{o: config, p: ['ballColorRandom'], v: false}]));
  generation.addChild(ballColorContainer);
  //ABILITIES
  const abilitiesContainer = new MainContainer('abilities', 'Abilities', null, [{o: config, p: ['currentMenu'], v: 'abilities'}]);
  const availableAbilities = Object.values(mouseAbilities).map(a => a.name);
  abilitiesContainer.addChild(new ConfigDropdown('mouse1', 'Power 1', null, 'push', availableAbilities, null));
  abilitiesContainer.addChild(new ConfigDropdown('mouse2', 'Power 2', null, 'pull', availableAbilities, [{o: config, p: ['enableMouse2'], v: true}]));
  const abilityLayout = new LayoutContainer('abilityLayout');
    //-push
  const pushContainer = new Container('pushContainer', 'Push', null, [{o: config, p: ['mouse1'], p2: ['mouse2'], v: 'push'}]);
  pushContainer.addChild(new ConfigDropdown('pushMode', 'Push Mode', {parent: mouseAbilities, path: ['push', 'mode']}, 'default', ['default', 'inverted']));
  pushContainer.addChild(new ConfigDropdown('pushType', 'Push Type', {parent: mouseAbilities, path: ['push', 'type']}, 'linear', pushTypes)); 
  pushContainer.addChild(new ConfigNumber('pushStrength', 'Push Strength', {parent: mouseAbilities, path: ['push', 'strength']}, 1.5, 0, Infinity, .01));
  pushContainer.addChild(new ConfigNumber('pushRadius', 'Push Radius', {parent: mouseAbilities, path: ['push', 'radius']}, 1.5, 0, Infinity, .01));
  pushContainer.addChild(new ConfigNumber('pushInterval', 'Repeat Interval(ms)', {parent: mouseAbilities, path: ['push', 'interval']}, 50, 0, Infinity, 1));
  abilityLayout.addChild(pushContainer);
    //-pull
  const pullContainer = new Container('pullContainer', 'Pull', null, [{o: config, p: ['mouse1'], p2: ['mouse2'], v: 'pull'}]);
  pullContainer.addChild(new ConfigDropdown('pullMode', 'Pull Mode', {parent: mouseAbilities, path: ['pull', 'mode']}, 'default', ['default', 'inverted']));
  pullContainer.addChild(new ConfigDropdown('pullType', 'Pull Type', {parent: mouseAbilities, path: ['pull', 'type']}, 'linear', pullTypes)); 
  pullContainer.addChild(new ConfigNumber('pullStrength', 'Pull Strength', {parent: mouseAbilities, path: ['pull', 'strength']}, 1.5, 0, Infinity, .01));
  pullContainer.addChild(new ConfigNumber('pullRadius', 'Pull Radius', {parent: mouseAbilities, path: ['pull', 'radius']}, 1.5, 0, Infinity, .01));
  pullContainer.addChild(new ConfigNumber('pullInterval', 'Repeat Interval(ms)', {parent: mouseAbilities, path: ['pull', 'interval']}, 50, 0, Infinity, 1));
  abilityLayout.addChild(pullContainer);
    //-split
  const splitContainer = new Container('splitContainer', 'Split', null, [{o: config, p: ['mouse1'], p2: ['mouse2'], v: 'split'}]);
  splitContainer.addChild(new ConfigNumber('splitCount', 'Split Count', {parent: mouseAbilities, path: ['split', 'count']}, 2, 2, Infinity, 1));
  splitContainer.addChild(new ConfigNumber('splitSpeed', 'Split Speed', {parent: mouseAbilities, path: ['split', 'strength']}, 1, 0, Infinity, .01));
  splitContainer.addChild(new ConfigCheckbox('splitRepeats', 'Repeats', {parent: mouseAbilities, path: ['split', 'repeats']}, false));
  splitContainer.addChild(new ConfigNumber('splitInterval', 'Repeat Interval(ms)', {parent: mouseAbilities, path: ['split', 'interval']}, 50, 0, Infinity, 1));
  abilityLayout.addChild(splitContainer);
    //-generate
  const generateContainer = new Container('generateContainer', 'Generate', null, [{o: config, p: ['mouse1'], p2: ['mouse2'], v: 'generate'}]);
  generateContainer.addChild(new ConfigNumber('clickGenerateCount', 'Generate Count', {parent: mouseAbilities, path: ['generate', 'count']}, 2, 1, Infinity, 1));
  generateContainer.addChild(new ConfigNumber('clickGenerateSpeed', 'Generate Speed', {parent: mouseAbilities, path: ['generate', 'strength']}, 1, 0, Infinity, .01));
  generateContainer.addChild(new ConfigCheckbox('generateRepeats', 'Repeats', {parent: mouseAbilities, path: ['generate', 'repeats']}, false));
  generateContainer.addChild(new ConfigNumber('generateInterval', 'Repeat Interval(ms)', {parent: mouseAbilities, path: ['generate', 'interval']}, 50, 0, Infinity, 1));
  abilityLayout.addChild(generateContainer);
    //-delete
  const deleteContainer = new Container('deleteContainer', 'Delete', null, [{o: config, p: ['mouse1'], p2: ['mouse2'], v: 'delete'}]);
  deleteContainer.addChild(new ConfigNumber('deleteRadius', 'Delete Radius', {parent: mouseAbilities, path: ['delete', 'radius']}, 10, 0, Infinity, 1));
  abilityLayout.addChild(deleteContainer);
    //-color
  const colorContainer = new Container('colorContainer', 'Color', null, [{o: config, p: ['mouse1'], p2: ['mouse2'], v: 'color'}]);
  colorContainer.addChild(new ConfigNumber('clickColorRadius', 'Color Radius', {parent: mouseAbilities, path: ['color', 'radius']}, 10, 0, Infinity, 1));
  colorContainer.addChild(new ConfigCheckbox('clickColorRandom', 'Random Color', {parent: mouseAbilities, path: ['color', 'colorRandom']}, false));
  colorContainer.addChild(new ConfigSlider('clickColorR', 'R', {parent: mouseAbilities, path: ['color', 'color', 'r']}, 255, 0, 255, 1, null, null, null, [{o: mouseAbilities, p: ['color', 'colorRandom'], v: false}]));
  colorContainer.addChild(new ConfigSlider('clickColorG', 'G', {parent: mouseAbilities, path: ['color', 'color', 'g']}, 255, 0, 255, 1, null, null, null, [{o: mouseAbilities, p: ['color', 'colorRandom'], v: false}]));
  colorContainer.addChild(new ConfigSlider('clickColorB', 'B', {parent: mouseAbilities, path: ['color', 'color', 'b']}, 255, 0, 255, 1, null, null, null, [{o: mouseAbilities, p: ['color', 'colorRandom'], v: false}]));
  colorContainer.addChild(new ConfigNumber('colorInterval', 'Repeat Interval(ms)', {parent: mouseAbilities, path: ['color', 'interval']}, 50, 0, Infinity, 1));
  abilityLayout.addChild(colorContainer);
  abilitiesContainer.addChild(abilityLayout);

  const settingsContainer = document.querySelector('.settings-col');
  settingsContainer.appendChild(general.element);
  settingsContainer.appendChild(generation.element);
  settingsContainer.appendChild(abilitiesContainer.element);
  general.addEventListeners();
  generation.addEventListeners();
  abilitiesContainer.addEventListeners();

  for (const object of Object.values(configDOM)) {
    if (object.type === 'input') {
      object.setValue(object.getConfigValue(), true);
    }
  }
}

//changes settings based on if device is mobile
function setupMobile() {
  if (window.innerWidth <= 800 && window.innerHeight <= 800 ||
      window.innerWidth <= 1000 && window.innerHeight <= 600) {
    configDOM.mouse2.setValue('none');
    config.enableMouse2 = false;
  }
}

//initialises the page. DO NOT RUN MORE THAN ONCE!
async function init() {
  
  initAbilities();

  initInputs();

  checkMouseValues();

  addEventListeners();

  setupMobile();

  updateMenu();

  selectSection('general');
  
  //generates the balls
  addBalls(config.ballGenCount);

  //initiates the loop
  loop()
}

//=========THINGS RUN HERE=========//

init();