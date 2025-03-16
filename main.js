// setup canvas

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const pageWrapper = document.getElementById('page-wrapper');

let width = canvas.width = pageWrapper.clientWidth;
let height = canvas.height = pageWrapper.clientHeight;

let balls = [];
let requestId; //animationRequest
let playing = true; //pause/play
let mouseX = 0;
let mouseY = 0;
let mouse1Down = false;
let mouse2Down = false;
let touchesList = [];

//holds all game data (configs, ect)
class Game {
  constructor() {
    //configurable settings
    this.config = {
      friction: 0,
      gravityX: 0,
      gravityY: 0,
      enableAbsorb: false,
      absorbThresh: 0, //min combined velocity to absorb
      minSize: 10,
      maxSize: 20,
      maxSpeed: 0.5,
      ballCount: 100,
      collision: true,
      clickGenerateCount: 1,
      clickGenerateSpeed: 1,
      deleteRadius: 1,
      splitCount: 2,
      splitSpeed: 1,
      pushMode: 'default',
      pushStrength: 1.5,
      pushRadius: 150,
      pushType: 'linear',
      pullMode: 'default',
      pullStrength: 1.5,
      pullRadius: 200,
      pullType: 'linear'
    }
  }
}

let game = new Game();
let config = game.config;
//mouse click settings
let abilities = {};
let settings = {};
let currentSettings = {};
let mouse1 = 'push'; //command for left click
let mouse2 = 'pull'; //command for right click


class Debug {
  constructor() {
    this.queue = ['yoooooo']; //example element would be {'mouseX: 746'}
    this.container = document.getElementById('debug');
    this.output = this.container.querySelector('output');
    this.disabled = false;
    this.toggle();
    // this.toggle();
  }

  getTouchPositions() {
    for (const touch of touchesList) {
      if (!touch) { continue }
      this.queue.push(`Touch-${touch.id}-X: ${touch.x}`);
      this.queue.push(`Touch-${touch.id}-Y: ${touch.y}`);
    }
    this.printQueue();
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

//base class for inputs
class Input {
  constructor(id, type, parentID, displayName, value, dependants) {
    this.id = id;
    this.type = type;
    this.parentID = parentID;
    this.displayName = displayName;
    this.value = value;
    this.dependants = dependants || [];
    this.hidden = true;
    this.element;
  }

  //builds element in parent element
  spawn() {
    this.element = this.generateBase();
    document.getElementById(parentID).appendChild(this.element);
  }
  generateBase() {
    let element = document.createElement('div');
    element.type = this.type;
    element.classList.add('settings-row');
    element.classList.add('hidden');
    element.classList.add(`${this.type}-row`);
    return element;
  }
  //hides the element
  hide() {
    this.getElement().classList.add('hidden');
  }
  //shows the element
  show() {
    this.getElement().classList.remove('hidden');
  }
  //hides if requirements not met, shows if they are met
  checkRequirements() {
    if (this.requirements(this)) {
      this.show();
    } else {
      this.hide();
    }
  }
  //gets the DOM element for this input
  getElement() {
    return document.getElementById(this.id);
  }
}

//class for number inputs
class numberInput extends Input {
  constructor(id, parentID, displayName, value=0, min, max, step, requirements) {
    super(id, 'number', parentID, displayName, value ?? 0, requirements);
    this.min = min ?? -Infinity;
    this.max = max ?? -Infinity;
    this.step = step ?? 1;
  }

  spawn() {
    let element = this.generateBase();
    element.innerHTML = `
              <label for="${this.id}">${this.displayName}</label>
              <input type="number" id="${this.id}-input" value="${this.value}"  step="${this.step}">`
  }

}

//base class for a config object
//holds a DOM element and an option
class Config {

}

//base class for abilities
class Ability {
  constructor(name, repeats, interval=20) {
    this.name = name;
    this.repeats = repeats;
    this.interval = interval;
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
    ctx.fillStyle = `rgb(${this.r}, ${this.g}, ${this.b}`;
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  //gets area of ball
  getArea() {
    return Math.PI * this.radius ** 2
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
    biggerBall.r = ((biggerBall.r + smallerBall.r) / 2 + random(0, 255) * 2) / 3;
    biggerBall.g = ((biggerBall.g + smallerBall.g) / 2  + random(0, 255) * 2) / 3;
    biggerBall.b = ((biggerBall.b + smallerBall.b) / 2  + random(0, 255) * 2) / 3;
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
      if (!(this === balls[j])) {
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
  }

  //calculates balls next position/vectors
  update() {
    if ((this.x + this.radius) >= width) {
      this.momentumX = -(this.momentumX);
      this.x = width - this.radius;
    }

    if ((this.x - this.radius) <= 0) {
      this.momentumX = -(this.momentumX);
      this.x = 0 + this.radius;
    }

    if ((this.y + this.radius) >= height) {
      this.momentumY = -(this.momentumY);
      this.y = height - this.radius;
    }

    if ((this.y - this.radius) <= 0) {
      this.momentumY = -(this.momentumY);
      this.y = 0 + this.radius;
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
  }
  
  //splits a ball into 2 or more
  split(splits) {
    let randomDeg = random(0, 360);
    let splitSpeed = config.splitSpeed;
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
function loop() {
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < balls.length; i++) {
    balls[i].draw();
    balls[i].update();
    balls[i].collisionDetect();
  }

  requestId = requestAnimationFrame(loop);

  debug.getTouchPositions();
}

//populates screen with balls
function addBalls(num, size, x, y, speed, vx, vy) {
  for (let i = 0; i < num; i++) {
    let radius = size || random(config.minSize, config.maxSize);
    let newSpeed = speed ?? config.maxSpeed
    let ball = new Ball(
      // ball position always drawn at least one ball width
      // away from the edge of the canvas, to avoid drawing errors
      x ?? random(0 + radius,width - radius),
      y ?? random(0 + radius,height - radius),
      vx ?? random(-newSpeed * 100,newSpeed * 100) / 100,
      vy ?? random(-newSpeed * 100,newSpeed * 100) / 100,
      [random(0,255), random(0,255), random(0,255)],
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
    addBalls(config.ballCount);
  } else if (id === 'settings-toggle') {
    document.getElementById('settings').classList.toggle('hidden');
  } else if (id === 'settings-close') {
    document.getElementById('settings').classList.add('hidden');
  }
}

//updates the elements in menu; some may need to be hidden, others shown
function updateMenu() {
  if (config.enableAbsorb === true) {
    show(document.querySelector('.settings-row:has(#absorption-threshold-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#absorption-threshold-input)'));
  }
  if (config.collision === true) {
    show(document.querySelector('.settings-row:has(#absorption-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#absorption-input)'));
    hide(document.querySelector('.settings-row:has(#absorption-threshold-input)'));
  }

  if (mouse1 === 'generate' || mouse2 === 'generate') {
    show(document.querySelector('.settings-row:has(#generate-count-input)'));
    show(document.querySelector('.settings-row:has(#generate-speed-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#generate-count-input)'));
    hide(document.querySelector('.settings-row:has(#generate-speed-input)'));
  }
  if (mouse1 === 'delete' || mouse2 === 'delete') {
    show(document.querySelector('.settings-row:has(#delete-radius-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#delete-radius-input)'));
  }
  if (mouse1 === 'split' || mouse2 === 'split') {
    show(document.querySelector('.settings-row:has(#split-count-input)'));
    show(document.querySelector('.settings-row:has(#split-speed-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#split-count-input)'));
    hide(document.querySelector('.settings-row:has(#split-speed-input)'));
  }
  if (mouse1 === 'push' || mouse2 === 'push') {
    show(document.querySelector('.settings-row:has(#push-mode-input)'));
    show(document.querySelector('.settings-row:has(#push-type-input)'));
    show(document.querySelector('.settings-row:has(#push-strength-input)'));
    show(document.querySelector('.settings-row:has(#push-radius-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#push-mode-input)'));
    hide(document.querySelector('.settings-row:has(#push-type-input)'));
    hide(document.querySelector('.settings-row:has(#push-strength-input)'));
    hide(document.querySelector('.settings-row:has(#push-radius-input)'));
  }
  if (mouse1 === 'pull' || mouse2 === 'pull') {
    show(document.querySelector('.settings-row:has(#pull-mode-input)'));
    show(document.querySelector('.settings-row:has(#pull-type-input)'));
    show(document.querySelector('.settings-row:has(#pull-strength-input)'));
    show(document.querySelector('.settings-row:has(#pull-radius-input)'));
  } else {
    hide(document.querySelector('.settings-row:has(#pull-mode-input)'));
    hide(document.querySelector('.settings-row:has(#pull-type-input)'));
    hide(document.querySelector('.settings-row:has(#pull-strength-input)'));
    hide(document.querySelector('.settings-row:has(#pull-radius-input)'));
  }
}

//sets variables to values of inputs
function inputHandler(e) {
  let input = e.target;
  let id = input.id;
  if (id === 'gravity-x-input' || id === 'gravity-x-input-slider') {
    config.gravityX = Number(input.value);
  } else if (id === 'gravity-y-input' || id === 'gravity-y-input-slider') {
    config.gravityY = Number(input.value);
  } else if (id === 'friction-input' || id === 'friction-input-slider') {
    config.friction = Number(input.value);
  } else if (id === 'absorption-input') {
    config.enableAbsorb = Boolean(input.checked);
  } else if (id === 'absorption-threshold-input') {
    config.absorbThresh = Number(input.value);
  } else if (id === 'ballcount-input') {
    config.ballCount = Number(input.value);
  } else if (id === 'min-size-input') {
    config.minSize = Number(input.value);
  } else if (id === 'max-size-input') {
    config.maxSize = Number(input.value);
  } else if (id === 'max-speed-input') {
    config.maxSpeed = Number(input.value);
  } else if (id === 'collision-input') {
    config.collision = Boolean(input.checked);
  } else if (id === 'mouse1-input') {
    mouse1 = String(input.value);
  } else if (id === 'mouse2-input') {
    mouse2 = String(input.value);
  } else if (id === 'generate-count-input') {
    config.clickGenerateCount = Number(input.value);
  } else if (id === 'generate-speed-input') {
    config.clickGenerateSpeed = Number(input.value);
  } else if (id === 'delete-radius-input') {
    config.deleteRadius = Number(input.value);
  } else if (id === 'split-count-input') {
    config.splitCount = Number(input.value);
  } else if (id === 'split-speed-input') {
    config.splitSpeed = Number(input.value);
  } else if (id === 'push-mode-input') {
    config.pushMode = String(input.value);
  } else if (id === 'push-type-input') {
    config.pushType = String(input.value);
  } else if (id === 'push-strength-input') {
    config.pushStrength = Number(input.value);
  } else if (id === 'push-radius-input') {
    config.pushRadius = Number(input.value);
  } else if (id === 'pull-mode-input') {
    config.pullMode = String(input.value);
  } else if (id === 'pull-strength-input') {
    config.pullStrength = Number(input.value);
  } else if (id === 'pull-radius-input') {
    config.pullRadius = Number(input.value);
  } else if (id === 'pull-type-input') {
    config.pullType = String(input.value);
  }
  updateMenu()
}

//does an action to every ball that meets a given condition
function checkAllCollisions(x, y, radius, action, condition) {
  if (!condition) {
    condition = (ball, dist) => dist < ball.radius + radius;
  }
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([x, y], [balls[j].x, balls[j].y])
    if (condition(balls[j], distance)) {
      action(balls[j], distance);
    }
  }
}

//does an action to every ball that is not colliding with a radius
function checkAllNonCollisions(x, y, radius, action) {
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([x, y], [balls[j].x, balls[j].y])
    if (distance > balls[j].radius + radius) {
      action(balls[j], distance);
    }
  }
}

//does an action to every ball that is not colliding with a radius
function checkAllNonCollisions(x, y, radius, action) {
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([x, y], [balls[j].x, balls[j].y])
    if (distance > balls[j].radius + radius) {
      action(balls[j], distance);
    }
  }
}

//does an action to the first ball that is colliding with a radius
function checkOneCollision(x, y, radius, action) {
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([x, y], [balls[j].x, balls[j].y])
    if (distance < balls[j].radius + radius) {
      action(balls[j], distance);
      return;
    }
  }
}

//deletes balls within a radius
function deleteBalls(x, y, radius) {
  checkAllCollisions(x, y, radius, (ball) => {
    balls.splice(balls.indexOf(ball), 1);
  })
}

//adds to velocity of an object
function applyForce(object, forceX, forceY) {
  object.setVelocity(object.velX - forceX, object.velY - forceY)
}

//applies a force to a ball based on its distance to a point
function generateForce(ball, type, mode, dist, x, y, strength) {
  let forceX, forceY;
    let xSign = (x - ball.x > 0) ? 1: -1;
    let YSign = (y - ball.y > 0) ? 1: -1;

    if (type === 'test') {
      forceX = (strength * 100) / (x - ball.x) / (dist * dist);
      forceY = (strength * 100) / (y - ball.y) / (dist * dist);
    } else if (type === 'linear') {
      forceX = (strength / 1000) * (x - ball.x);
      forceY = (strength / 1000) * (y - ball.y);
    } else if (type === 'constant') {
      forceX = (strength / 10) * (x - ball.x) / dist;
      forceY = (strength / 10) * (y - ball.y) / dist;
    } else if (type === 'cross1') {
      forceX = (strength / 10) / (x - ball.x);
      forceY = (strength / 10) / (y - ball.y);
    } else if (type === 'cross2') {
      forceX = (strength / 100) * Math.log10(dist) * xSign;
      forceY = (strength / 100) * Math.log10(dist) * YSign;
    } else if(type === 'cross3') {
      forceX = (strength / 500) / (x - ball.x) * dist;
      forceY = (strength / 500) / (y - ball.y) * dist;
    } else if (type === 'cross4') {
      forceX = (strength * 10) / (x - ball.x) / dist;
      forceY = (strength * 10) / (y - ball.y) / dist;
    }

    if (mode === 'pull') {
      forceX = -forceX;
      forceY = -forceY;
    }

    applyForce(ball, forceX, forceY);
}

//applies force to all balls in a radius
function forceBalls(x, y, radius, strength, mode, type='linear') {
  if (mode === 'push' && config.pushMode === 'default') {
    checkAllCollisions(x, y, radius, (ball, dist) => {
      generateForce(ball, type, mode, dist, x, y, strength)
    })
  } else if (mode === 'push' && config.pushMode === 'inverted') {
    checkAllNonCollisions(x, y, radius, (ball, dist) => {
      generateForce(ball, type, mode, dist, x, y, strength)
    })
  } else if (mode === 'pull' && config.pullMode === 'default') {
    checkAllCollisions(x, y, radius, (ball, dist) => {
      generateForce(ball, type, mode, dist, x, y, strength)
    })
  } else if (mode === 'pull' && config.pullMode === 'inverted') {
    checkAllNonCollisions(x, y, radius, (ball, dist) => {
      generateForce(ball, type, mode, dist, x, y, strength)
    })
  }
}

//attracts balls to a point
function pullBalls(x, y, radius, strength, type) {
  forceBalls(x, y, radius, strength, 'pull', type);
}

//pushes balls away from a point
function pushBalls(x, y, radius, strength, type) {
  forceBalls(x, y, radius, strength, 'push', type);
}

//uses an ability at a coordinate
function useAbility(ability, [x, y]) {
  if (ability === 'generate') {
    addBalls(config.clickGenerateCount, null, x, y, config.clickGenerateSpeed)
  } else if (ability === 'delete') {
    deleteBalls(x, y, config.deleteRadius);
  } else if (ability === 'split') {
    checkOneCollision(x, y, 1, (ball) => {
      ball.split(config.splitCount);
    }) 
  } else if (ability === 'push') {
    pushBalls(x, y, config.pushRadius, config.pushStrength, config.pushType);
  } else if (ability === 'pull') {
    pullBalls(x, y, config.pullRadius, config.pullStrength, config.pullType);
  } 
}

//repeats an ability at a given interval until the condition is not met.
//the x and y positions are dynamically generated by the coordGetter function
async function repeatAbility(ability, interval, coordGetter, condition) {
  if (!condition) {
    condition = () => false;
  }
  do {
    useAbility(ability, coordGetter())
    await sleep(interval || 1);
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
    ability = abilities[mouse1];
    mouse1Down = true;
    isMouseDown = () => mouse1Down;
  } else if (e.button === 2) { //right mouse
    ability = abilities[mouse2];
    mouse2Down = true;
    isMouseDown = () => mouse2Down;
  }

  if (ability.repeats) {
    repeatAbility(ability.name, ability.interval, ()=>[mouseX, mouseY], isMouseDown);
  } else {
    useAbility(ability.name, [mouseX, mouseY]);
  }
}

//what happens when the canvas is tapped (touchscreen, multitouch)
function touchHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  let ability = abilities[mouse1];
  let touches = e.targetTouches;
  for (const touch of touches) {
    let id = touch.identifier
    touchesList[id] = {id: id, x: touch.clientX, y: touch.clientY, timeoutId: setTimeout(() => {delete touchesList[id]}, 15000)}
  
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
    if (!TouchList[id]) { continue }
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

//sets up the event listeners
function addEventListeners() {

  //links sliders and number inputs
  document.querySelectorAll('.slider-row').forEach(row => {
    const numInput = row.querySelector('input[type=number]');
    const slider = row.querySelector('input[type=range]');
  
    numInput.addEventListener('input', () => {
      slider.value = numInput.value;
    })
    slider.addEventListener('input', () => {
      numInput.value = slider.value;
    })
  })

  //input events
  document.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('input', inputHandler);
  })

  //adds button handler to each button
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', buttonHandler);
  })
  
  //enables canvas to respond to screen size changes
  window.addEventListener('resize', () => {
    width = canvas.width = pageWrapper.clientWidth;
    height = canvas.height = pageWrapper.clientHeight;
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
  abilities.generate = new Ability('generate', false);
  abilities.delete = new Ability('delete', true, 5);
  abilities.split = new Ability('split', false);
  abilities.push = new Ability('push', true);
  abilities.pull = new Ability('pull', true);
}

//creates input objects and populates settings menu 
function initInputs() {
  
}

//changes settings based on if device is mobile
function setupMobile() {
  if (window.innerWidth <= 800 && window.innerHeight <= 600) {
    //do stuff
  }
}

//initialises the page. DO NOT RUN MORE THAN ONCE!
async function init() {

  initInputs();

  initAbilities();

  addEventListeners();

  updateMenu()
  
  //generates the balls
  addBalls(config.ballCount);
  
  //initiates the loop
  loop()
}

//=========THINGS RUN HERE=========//

init();