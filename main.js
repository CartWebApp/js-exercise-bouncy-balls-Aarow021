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

function getDistance([x1, y1], [x2, y2]) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance
}

function Ball(x, y, velX, velY, [r, g, b], size) {
  this.x = x;
  this.y = y;
  this.velX = velX;
  this.velY = velY;
  this.r = r;
  this.g = g;
  this.b = b;
  this.size = size;
}

Ball.prototype.draw = function() {
  ctx.beginPath();
  ctx.fillStyle = `rgb(${this.r}, ${this.g}, ${this.b}`;
  ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
  ctx.fill();
}

Ball.prototype.update = function() {
  if ((this.x + this.size) >= width) {
    this.velX = -(this.velX);
    this.x = width - this.size
  }

  if ((this.x - this.size) <= 0) {
    this.velX = -(this.velX);
    this.x = 0 + this.size
  }

  if ((this.y + this.size) >= height) {
    this.velY = -(this.velY);
    this.y = height - this.size
  }

  if ((this.y - this.size) <= 0) {
    this.velY = -(this.velY);
    this.y = 0 + this.size
  }

  this.x += this.velX;
  this.y += this.velY;

}

while (balls.length < 25) {
  let size = random(10,20);
  let ball = new Ball(
    // ball position always drawn at least one ball width
    // away from the edge of the canvas, to avoid drawing errors
    random(0 + size,width - size),
    random(0 + size,height - size),
    random(-7,7),
    random(-7,7),
    [random(0,255), random(0,255), random(0,255)],
    size
  );

  balls.push(ball);
}

Ball.prototype.collisionDetect = function() {
  for (let j = 0; j < balls.length; j++) {
    if (!(this === balls[j])) {

      const distance = getDistance([this.x, this.y], [balls[j].x, balls[j].y])

      if (distance < this.size + balls[j].size) {
        biggerBall = balls[j].size > this.size ? balls[j] : this
        smallerBall = balls[j].size < this.size ? balls[j] : this
        biggerBall.r = (biggerBall.r + smallerBall.r) / 2;
        biggerBall.g = (biggerBall.g + smallerBall.g) / 2;
        biggerBall.b = (biggerBall.b + smallerBall.b) / 2;
        biggerBall.velX = (biggerBall.velX + (smallerBall.velX * (smallerBall.size / biggerBall.size)));
        biggerBall.velY = (biggerBall.velY + smallerBall.velY);
        biggerBall.size = (biggerBall.size + smallerBall.size * .9);
        balls.splice(balls.indexOf(smallerBall), 1)
      }
    }
  }
}

Ball.prototype.split = function() {
  let splits = random(2, 4);
  
}

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

function clickHandler(e) {
  let mouseX = e.clientX;
  let mouseY = e.clientY;
  for (let j = 0; j < balls.length; j++) {
    let distance = getDistance([mouseX, mouseY], [balls[j].x, balls[j].y])
    if (distance < this.size) {

    }
  }
  
}

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
})

window.addEventListener('click', clickHandler)

loop()