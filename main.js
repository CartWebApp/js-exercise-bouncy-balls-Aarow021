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
  constructor(x, y, velX, velY, [r, g, b], size) {
    this.x = x;
    this.y = y;
    this.velX = velX;
    this.velY = velY;
    this.r = r;
    this.g = g;
    this.b = b;
    this.size = size;
    //this.momentum = size * (Math.abs(velX) + Math.abs(velY));
  }

  //draws
  draw() {
    ctx.beginPath();
    ctx.fillStyle = `rgb(${this.r}, ${this.g}, ${this.b}`;
    ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    ctx.fill();
  }

  //handles ball collision checking and actions
collisionDetect() {
  for (let j = 0; j < balls.length; j++) {
    if (!(this === balls[j])) {

      const distance = getDistance([this.x, this.y], [balls[j].x, balls[j].y]);

      //collision condition
      if (distance < this.size + balls[j].size) {
        let biggerBall = balls[j].size > this.size ? balls[j] : this;
        let smallerBall = balls[j].size < this.size ? balls[j] : this;
        biggerBall.r = (biggerBall.r + smallerBall.r) / 2;
        biggerBall.g = (biggerBall.g + smallerBall.g) / 2;
        biggerBall.b = (biggerBall.b + smallerBall.b) / 2;
        biggerBall.velX = biggerBall.velX + (smallerBall.velX * (smallerBall.size / biggerBall.size));
        biggerBall.velY = (biggerBall.velY + smallerBall.velY);
        biggerBall.size = (biggerBall.size + smallerBall.size * .9);
        balls.splice(balls.indexOf(smallerBall), 1);
      }
    }
  }
}

  //calculates balls next position/vectors
  update() {
    if ((this.x + this.size) >= width) {
      this.velX = -(this.velX);
      this.x = width - this.size;
    }

    if ((this.x - this.size) <= 0) {
      this.velX = -(this.velX);
      this.x = 0 + this.size;
    }

    if ((this.y + this.size) >= height) {
      this.velY = -(this.velY);
      this.y = height - this.size;
    }

    if ((this.y - this.size) <= 0) {
      this.velY = -(this.velY);
      this.y = 0 + this.size;
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
    if (distance < this.size) {
      //Split
    }
  }
}

//populates screen with balls
function addBalls(num, x, y) {
  for (let i = 0; i < num; i++) {
    let size = random(10,20);
    let ball = new Ball(
      // ball position always drawn at least one ball width
      // away from the edge of the canvas, to avoid drawing errors
      x || random(0 + size,width - size),
      y || random(0 + size,height - size),
      random(-7,7),
      random(-7,7),
      [random(0,255), random(0,255), random(0,255)],
      size
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
addBalls(20);

//initiates the loop
loop()