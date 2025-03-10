// setup canvas

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const pageWrapper = document.getElementById('page-wrapper');

let width = canvas.width = pageWrapper.clientWidth;
let height = canvas.height = pageWrapper.clientHeight;

let balls = [];
let requestId;
let playing = true;

//configurable settings
let friction = 0;
let gravity = 0;
let enableAbsorb = false;
let absorbThresh = 0;   //min combined velocity to absorb
let minSize = 15;
let maxSize = 30;
let maxSpeed = .5;
let ballCount = 100;

//function to generate random number
function random(min, max) {
  const num = Math.floor(Math.random() * (max - min + 1)) + min;
  return num;
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
    let smallerBall = ball2.mass < this.mass ? ball2 : this;
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
    for (let j = 0; j < balls.length; j++) {
      if (!(this === balls[j])) {
        const distance = getDistance([this.x, this.y], [balls[j].x, balls[j].y]);

        //collision condition
        if (distance < this.radius + balls[j].radius && !this.isRebounding(balls[j])) {
          //If the velocity between the two are great enough
          if (enableAbsorb && Math.abs((this.velX - balls[j].velX) + (this.velY - balls[j].velY)) > absorbThresh) {
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

    this.momentumX *= 1 - friction;
    this.momentumY *= 1 - friction;
    this.momentumY += gravity * this.mass;

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
  split() {
    let splits = random(2, 4);

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
}

//handles what happens when the page is clicked
function clickHandler(e) {
  let mouseX = e.clientX;
  let mouseY = e.clientY;
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([mouseX, mouseY], [balls[j].x, balls[j].y])
    if (distance < this.radius) {
      //Split
    }
  }
}

//populates screen with balls
function addBalls(num, size, x, y, vx, vy) {
  for (let i = 0; i < num; i++) {
    let radius = size || random(minSize, maxSize);
    let ball = new Ball(
      // ball position always drawn at least one ball width
      // away from the edge of the canvas, to avoid drawing errors
      x ?? random(0 + radius,width - radius),
      y ?? random(0 + radius,height - radius),
      vx ?? random(-maxSpeed,maxSpeed),
      vy ?? random(-maxSpeed,maxSpeed),
      [random(0,255), random(0,255), random(0,255)],
      radius
    );
  
    balls.push(ball);
  }    
}

function stopCanvas() {
  playing = false;
  cancelAnimationFrame(requestId);
}

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
    addBalls(ballCount);
  } else if (id === 'settings-toggle') {
    document.getElementById('settings').classList.toggle('hidden');
  } else if (id === 'settings-close') {
    document.getElementById('settings').classList.add('hidden');
  }
}

//adds button handler to each button
document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', buttonHandler);
})

//enables canvas to respond to screen size changes
window.addEventListener('resize', () => {
  width = canvas.width = pageWrapper.clientWidth;
  height = canvas.height = pageWrapper.clientHeight;
})

//adds click event
window.addEventListener('click', clickHandler)

//generates the balls
addBalls(ballCount);

//initiates the loop
loop()