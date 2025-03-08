// setup canvas

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

let balls = [];

// function to generate random number

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
  }

  //draws
  draw() {
    ctx.beginPath();
    ctx.fillStyle = `rgb(${this.r}, ${this.g}, ${this.b}`;
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  getArea() {
    return Math.PI * this.radius ** 2
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

  //fuses this ball with another. The largest one is kept
  fuse(ball2) {
    let biggerBall = ball2.radius > this.radius ? ball2 : this;
    let smallerBall = ball2.radius < this.radius ? ball2 : this;
    let massRatio = smallerBall.mass / biggerBall.mass;
    //color
    biggerBall.r = ((biggerBall.r + smallerBall.r) / 2 + random(0, 255)) / 2;
    biggerBall.g = ((biggerBall.g + smallerBall.g) / 2  + random(0, 255)) / 2;
    biggerBall.b = ((biggerBall.b + smallerBall.b) / 2  + random(0, 255)) / 2;

    //momentum
    biggerBall.momentumX += smallerBall.momentumX;
    biggerBall.momentumY += smallerBall.momentumY;
    //mass
    biggerBall.mass += smallerBall.mass;
    //radius
    biggerBall.radius = (biggerBall.radius + smallerBall.radius * .9);

    //Calculates new velocity and radius from new mass and momentum
    biggerBall.calcVelocity();
    biggerBall.calcRadius();

    //removes the smaller ball
    balls.splice(balls.indexOf(smallerBall), 1);
  }

  //handles ball collision checking and actions
  collisionDetect() {
    for (let j = 0; j < balls.length; j++) {
      if (!(this === balls[j])) {

        const distance = getDistance([this.x, this.y], [balls[j].x, balls[j].y]);

        //collision condition
        if (distance < this.radius + balls[j].radius) {
          this.fuse(balls[j])
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < balls.length; i++) {
    balls[i].draw();
    balls[i].update();
    balls[i].collisionDetect();
  }

  requestAnimationFrame(loop);
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
function addBalls(num, size, x, y) {
  for (let i = 0; i < num; i++) {
    let radius = size || random(10,30);
    let ball = new Ball(
      // ball position always drawn at least one ball width
      // away from the edge of the canvas, to avoid drawing errors
      x || random(0 + radius,width - radius),
      y || random(0 + radius,height - radius),
      random(-7,7),
      random(-7,7),
      [random(0,255), random(0,255), random(0,255)],
      radius
    );
  
    balls.push(ball);
  }    
}

//Enables canvas to respond to screen size changes
window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
})

//adds click event
window.addEventListener('click', clickHandler)

//initiates the balls
addBalls(10);

//initiates the loop
loop()