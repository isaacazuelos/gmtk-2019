/* eslint-disable no-case-declarations */
// A game for the GMTK Game Jam 2019
//
// https://itch.io/jam/gmtk-2019

// the code is bad, don't worry about it

// # Constants

const {
  Application,
  Loader,
  Texture,
} = PIXI; // eslint-disable-line no-undef

const color = {
  black: 0x000000,
  white: 0xFFFFFF,
  red: 0xFF0000,
};

// / 16:9 ish version of NES vertical resolution
const FRAME_WIDTH = 427;
const FRAME_HEIGHT = 240;

const PLAYER_THRUST = 1;
const PLAYER_MAX_MOVEMENT_SPEED = 2;
const PLAYER_FRICTION = 0.1;
const PLAYER_RADIUS = 7;

const PLAYER_INTO_SHIP_ALARM_LENGTH = 3.12;
const PLAYER_TRANSFORM_LENGTH = 1;
const PLAYER_COOLDOWN = 10;

const ENEMY_ANIMATION_SPEED = 0.1;
const ENEMY_RADIUS = [0, 6, 7, 8];
const ENEMY_BASE_SPEED = [0, 1, 2, 3];

const BULLET_SPEED = [0, 1, 2, 3];

// # Utility functions

const clamp = (smallest, number, largest) => Math.min(largest, Math.max(smallest, number));

const radToDeg = r => r / (2 * Math.PI) * 360;
const degToRad = d => (d / 360) * (2 * Math.PI);

const distance = (x1, y1, x2, y2) => {
  const x = (x1 - x2) * (x1 - x2);
  const y = (y1 - y2) * (y1 - y2);
  return Math.sqrt(x + y);
};

const angleTo = (x1, y1, x2, y2) => Math.atan2(x1 - x2, y2 - y1); // in rad

const collide = (a, b) => {
  const d = distance(a.x, a.y, b.x, b.y);
  return d <= (a.collisionRadius + b.collisionRadius);
};

const componenets = (theta) => {
  const dy = Math.cos(-theta);
  const dx = -Math.sin(theta);
  return [dx, dy];
};

// # Setup Functions

let app;

const createApp = () => {
  const newApp = new Application({
    // Game Boy Advanced screen size in pixels
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    resolution: 2,
  });

  newApp.renderer.backgroundColor = color.red;
  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

  newApp.stop();
  return newApp;
};

const load = (onCompletion) => {
  Loader.shared
    .add([
      './resources/player/ship/frame1.png',
      './resources/player/ship/stopped.png',
      // green-1
      './resources/enemy/green-1/dead.png',
      './resources/enemy/green-1/frame1.png',
      './resources/enemy/green-1/frame2.png',
      './resources/enemy/green-2/dead.png',
      './resources/enemy/green-2/frame1.png',
      './resources/enemy/green-2/frame2.png',
      './resources/enemy/green-3/dead.png',
      './resources/enemy/green-3/frame1.png',
      './resources/enemy/green-3/frame2.png',
    ])
    .on('progress', (loader, resource) => {
      console.log(`loading: ${resource.url}`);
      console.log(`progress: ${loader.progress}%`);
    })
    .load(onCompletion);
};

// This isn't efficient, but it works and is easy.
// eslint-disable-next-line no-unused-vars
const loadTextureArray = (dir, frameCount) => {
  if (typeof frameCount !== 'number' || frameCount <= 0) {
    throw new Error('must have a positive frameCount');
  }
  const textureArray = [];
  for (let i = 1; i <= frameCount; i += 1) {
    const texture = Texture.from(`${dir}/frame${i}.png`);
    textureArray.push(texture);
  }

  return textureArray;
};

class Bullet extends PIXI.AnimatedSprite {
  constructor(element, level) {
    super(loadTextureArray(`resources/bullet/${element}-${level}`, 1));
    this.level = level;
    this.element = element;
    this.anchor.set(0.5);
  }

  tick(delta) {
    const [dx, dy] = componenets(degToRad(this.angle) + Math.PI);
    this.x += dx * delta * BULLET_SPEED[this.level];
    this.y += dy * delta * BULLET_SPEED[this.level];
  }
}

class Enemy extends PIXI.AnimatedSprite {
  constructor(element, level, x, y) {
    const textureArray = loadTextureArray(`resources/enemy/${element}-${level}`, 2);

    super(textureArray);
    this.play();
    this.animationSpeed = ENEMY_ANIMATION_SPEED;

    this.anchor.set(0.5);
    this.x = x;
    this.y = y;

    this.level = level;
    this.hp = level;
  }

  get collisionRadius() {
    return ENEMY_RADIUS[this.level];
  }

  tick(delta, state) {
    this.move(delta, state.player);
    this.collisionCheck(state.bullets);
    this.face(state.player.x, state.player.y);
    this.cleanBullets()
  }

  cleanBullets() {
    const inArena = [];
    this.bullets.forEach((b) => {
      if (this.arena.contains(b.x, b.y)) {
        inArena.push(b);
      }
    });
    this.bullets = inArena;
  }

  move(delta, player) {
    switch (this.level) {
      default:
        this.moveToward(delta, player);
        break;
    }
  }

  moveToward(delta, player) {
    const direction = angleTo(this.x, this.y, player.x, player.y);
    const [dx, dy] = componenets(direction);

    this.x += dx * delta * ENEMY_BASE_SPEED[this.level];
    this.y += dy * delta * ENEMY_BASE_SPEED[this.level];
  }

  face(x, y) {
    const angle = radToDeg(angleTo(x, y, this.x, this.y));
    this.angle = angle;
  }

  collisionCheck(bullets) {
    bullets.forEach((bullet) => {
      if (collide(this, bullet)) {
        // kerblam!
      }
    });
  }
}

const Element = {
  green: 'green',
  red: 'red',
  blue: 'blue',
};

const Mode = {
  turret: 'turret',
  ship: 'ship',
  intoTurret: 'intoTurret',
  intoShip: 'intoShip',
};

class Player extends PIXI.AnimatedSprite {
  constructor() {
    const enginesOff = [Texture.from('resources/player/ship/stopped.png')];
    super(enginesOff);

    this.mode = Mode.ship;
    this.collisionRadius = PLAYER_RADIUS;

    this.lastBulletFired = -PLAYER_COOLDOWN;

    this.element = Element.green;
    this.level = null;

    this.textureArrays = {
      enginesOff,
      enginesOn: loadTextureArray('resources/player/ship', 1),
      turrets: {
        green: [Texture.from('resources/player/turret/green.png')],
      },
      intoTurret: loadTextureArray('resources/player/transform', 7),
      intoShip: loadTextureArray('resources/player/transform', 7).reverse(),
    };

    this.anchor.set(0.5);
    this.x = FRAME_WIDTH / 2;
    this.y = FRAME_HEIGHT / 2;

    this.dx = 0;
    this.dy = 0;

    this.left_thrust = false;
    this.right_thrust = false;
    this.up_thrust = false;
    this.down_thrust = false;
  }

  onPointerDown(event) {
    this.onPointerMove(event);
  }

  onPointerMove(event) {
    if (this.mode === Mode.turret) {
      const localPosition = event.data.getLocalPosition(this.parent);
      this.face(localPosition.x, localPosition.y);
      this.shouldShoot = true;
    }
  }

  face(x, y) {
    const angle = radToDeg(angleTo(x, y, this.x, this.y));
    this.angle = angle;
  }


  tick(delta, state) {
    if (this.mode === Mode.ship) {
      this.move(delta);
      this.rotate();
      this.updateEngineState();
    }

    console.log(this.lastBulletFired + PLAYER_COOLDOWN, state.time);
    if (this.shouldShoot && (this.lastBulletFired + PLAYER_COOLDOWN < state.time)) {
      this.lastBulletFired = state.time;
      this.shouldShoot = false;
      state.addBullet(this.x, this.y, this.angle, this.element, this.level);
    }

    this.collisionCheck(state.enemies);
  }

  // cheat code!
  toggleMode() {
    if (this.mode === Mode.ship) {
      this.intoTurret(Element.green, 1);
    } else if (this.mode === Mode.turret) {
      this.intoShip();
    } else {
      // do nothing, wait for transformation to finish.
    }
  }

  intoTurret(element, level) {
    this.mode = Mode.intoTurret;
    this.textures = this.textureArrays.intoTurret;
    this.loop = false;
    this.gotoAndPlay(0);
    this.onComplete = () => {
      // Not quite zero, so we can keep the same old angle.
      this.dx *= 0.00001;
      this.dy *= 0.00001;

      this.mode = Mode.turret;
      this.loop = true;

      this.element = element;
      this.level = level;
      this.textures = this.textureArrays.turrets[element];
    };
  }

  intoShip() {
    this.textures = this.textureArrays.intoShip;
    this.loop = false;
    this.gotoAndPlay(0);
    this.onComplete = () => {
      this.mode = Mode.ship;
    };
  }

  rotate() {
    if (this.mode === Mode.ship) {
      // face the direction of movement
      const angle = Math.atan2(this.dy, this.dx);
      this.angle = radToDeg(angle + (Math.PI / 2));
    }
    // faceing the pointer happens on events.
  }

  move(delta) {
    // add thrust to derivative
    this.dx -= this.left_thrust ? PLAYER_THRUST : 0;
    this.dx += this.right_thrust ? PLAYER_THRUST : 0;
    this.dy -= this.up_thrust ? PLAYER_THRUST : 0;
    this.dy += this.down_thrust ? PLAYER_THRUST : 0;

    this.dx = clamp(-PLAYER_MAX_MOVEMENT_SPEED, this.dx, PLAYER_MAX_MOVEMENT_SPEED);
    this.dy = clamp(-PLAYER_MAX_MOVEMENT_SPEED, this.dy, PLAYER_MAX_MOVEMENT_SPEED);

    // move by delta
    this.x += this.dx * delta;
    this.y += this.dy * delta;

    // friction for next time
    this.dx *= 1 - PLAYER_FRICTION;
    this.dy *= 1 - PLAYER_FRICTION;

    this.x = clamp(8, this.x, FRAME_WIDTH - 8);
    this.y = clamp(8, this.y, FRAME_HEIGHT - 8);
  }

  get engineIsOn() {
    return this.left_thrust || this.right_thrust || this.up_thrust || this.down_thrust;
  }

  updateEngineState() {
    if (this.engineIsOn) {
      this.textures = this.textureArrays.enginesOn;
    } else {
      this.textures = this.textureArrays.enginesOff;
    }
  }

  collisionCheck(enemies) {
    enemies.forEach((enemy) => {
      if (collide(this, enemy)) {
        this.intoTurret(enemy);
      }
    });
  }
}

// Largely from <https://github.com/kittykatattack/learningPixi#keyboard>
// Using `value` from <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values>
const keyboard = (values) => {
  const key = {};
  key.values = values;
  key.isDown = false;
  key.isUp = true;
  key.press = undefined;
  key.release = undefined;

  // The `downHandler`
  key.downHandler = (event) => {
    if (key.values.includes(event.key)) {
      if (key.isUp && key.press) key.press();
      key.isDown = true;
      key.isUp = false;
      event.preventDefault();
    }
  };

  // The `upHandler`
  key.upHandler = (event) => {
    if (key.values.includes(event.key)) {
      if (key.isDown && key.release) key.release();
      key.isDown = false;
      key.isUp = true;
      event.preventDefault();
    }
  };

  // Attach event listeners
  const downListener = key.downHandler.bind(key);
  const upListener = key.upHandler.bind(key);

  window.addEventListener(
    'keydown', downListener, false,
  );
  window.addEventListener(
    'keyup', upListener, false,
  );

  // Detach event listeners
  key.unsubscribe = () => {
    window.removeEventListener('keydown', downListener);
    window.removeEventListener('keyup', upListener);
  };

  return key;
};

// # Game loop and state

class State {
  constructor() {
    this.time = 0;

    const arena = new PIXI.AnimatedSprite(loadTextureArray('resources/arena', 1));
    arena.interactive = true;
    this.arena = arena;
    app.stage.addChild(this.arena);

    const player = new Player();
    this.player = player;
    arena.addChild(this.player);

    this.enemies = [];
    this.bullets = [];

    // left arrow key
    const left = keyboard(['ArrowLeft', 'a']);
    left.press = this.onLeftPress.bind(this);
    left.release = this.onLeftRelease.bind(this);
    this.left = left;

    const right = keyboard(['ArrowRight', 'd']);
    right.press = this.onRightPress.bind(this);
    right.release = this.onRightRelease.bind(this);
    this.right = right;

    const up = keyboard(['ArrowUp', 'w']);
    up.press = this.onUpPress.bind(this);
    up.release = this.onUpRelease.bind(this);
    this.up = up;

    const down = keyboard(['ArrowDown', 's']);
    down.press = this.onDownPress.bind(this);
    down.release = this.onDownRelease.bind(this);
    this.down = down;

    // temp for testing
    const space = keyboard(' ');
    space.press = player.toggleMode.bind(player);

    // bind player to pointer events
    arena.on('pointerdown', player.onPointerDown.bind(player));
    arena.on('pointermove', player.onPointerMove.bind(player))
  }

  // this could have been done better...

  onLeftPress() {
    this.player.left_thrust = true;
  }

  onLeftRelease() {
    this.player.left_thrust = false;
  }

  onRightPress() {
    this.player.right_thrust = true;
  }

  onRightRelease() {
    this.player.right_thrust = false;
  }

  onUpPress() {
    this.player.up_thrust = true;
  }

  onUpRelease() {
    this.player.up_thrust = false;
  }

  onDownPress() {
    this.player.down_thrust = true;
  }

  onDownRelease() {
    this.player.down_thrust = false;
  }

  tick(delta) {
    this.time += delta;
    this.player.tick(delta, this);
    this.bullets.forEach(b => b.tick(delta));
    this.enemies.forEach(e => e.tick(delta, this));
  }

  addBullet(x, y, angle, element, level) {
    const bullet = new Bullet(element, level);
    bullet.x = x;
    bullet.y = y;
    bullet.angle = angle;
    this.arena.addChild(bullet);
    this.bullets.push(bullet);
  }
}

const start = () => {
  const state = new State();
  app.ticker.add(state.tick.bind(state));
  app.start();
  console.log('game running!');
};

// Start the game

app = createApp();
document.getElementById('game').appendChild(app.view);
load(start);
