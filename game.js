// A game for the GMTK Game Jam 2019
//
// https://itch.io/jam/gmtk-2019

// the code is bad, don't worry about it
/* eslint-disable no-constant-condition */
/* eslint-disable no-continue */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-undef */
/* eslint-disable no-case-declarations */

// # Constants

const {
  Application,
  Texture,
} = PIXI; // eslint-disable-line no-undef

// 16:9 ish version of NES vertical resolution
const FRAME_WIDTH = 427;
const FRAME_HEIGHT = 240;

const PLAYER_ANIMATION_SPEED = 0.5;
const PLAYER_DEATH_ANIMATION_SPEED = 0.1;
const PLAYER_THRUST = 1;
const PLAYER_MAX_MOVEMENT_SPEED = 2;
const PLAYER_FRICTION = 0.1;
const PLAYER_RADIUS = 7;
const PLAYER_SHOCKWAVE_RADIUS = 16;
const PLAYER_TURRET_TIME = 200;
const PLAYER_COOLDOWN = 10;
// const PLAYER_INTO_SHIP_ALARM_LENGTH = 3.12;
// const PLAYER_TRANSFORM_LENGTH = 1;

const ENEMY_ANIMATION_SPEED = 0.1;
const ENEMY_RADIUS = [0, 6, 7, 8];
const ENEMY_BASE_SPEED = [0, 0.75, 0.5, 0.3];
const ENEMY_BLINKS = 4; // must be even
const ENEMY_BLINK_DURATION = 5;

const BULLET_SPEED = [0, 1.5, 2, 2.5];
const BULLET_ANIMATION_SPEED = 0.25;

const SPAWNER_COOLDOWN = 100;
const SPAWNER_COOLDOWN_DELTA = 0.90;
const SPAWNER_COOLDOWN_MIN = 20;
const SPAWNER_SAFE_DISTANCE = 64;
const SPAWNER_MAX_ATTEMPTS = 32;
const SPAWNER_COUNT_RATE = 20000;

const zIndex = {
  player: 100,
  enemy: 10,
  bullet: 5,
  corpse: 0,
};

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
  dying: 'dying',
  dead: 'dead',
};

// # Utility functions

const clamp = (smallest, number, largest) => Math.min(largest, Math.max(smallest, number));

const radToDeg = r => r / (2 * Math.PI) * 360;
const degToRad = d => (d / 360) * (2 * Math.PI);

const randInt = max => Math.floor(Math.random() * Math.floor(max));

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

  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

  newApp.stop();
  return newApp;
};

const Sound = {
  blue_1: PIXI.sound.Sound.from('resources/sounds/blue-1.mp3'),
  blue_2: PIXI.sound.Sound.from('resources/sounds/blue-2.mp3'),
  blue_3: PIXI.sound.Sound.from('resources/sounds/blue-3.mp3'),
  green_1: PIXI.sound.Sound.from('resources/sounds/green-1.mp3'),
  green_2: PIXI.sound.Sound.from('resources/sounds/green-2.mp3'),
  green_3: PIXI.sound.Sound.from('resources/sounds/green-3.mp3'),
  red_1: PIXI.sound.Sound.from('resources/sounds/red-1.mp3'),
  red_2: PIXI.sound.Sound.from('resources/sounds/red-2.mp3'),
  red_3: PIXI.sound.Sound.from('resources/sounds/red-3.mp3'),
  dead_1_1: PIXI.sound.Sound.from('resources/sounds/dead-1-1.mp3'),
  dead_1_2: PIXI.sound.Sound.from('resources/sounds/dead-1-2.mp3'),
  dead_1_3: PIXI.sound.Sound.from('resources/sounds/dead-1-3.mp3'),
  intoShip: PIXI.sound.Sound.from('resources/sounds/intoShip.mp3'),
  intoTurret: PIXI.sound.Sound.from('resources/sounds/intoTurret.mp3'),
};

const load = (onCompletion) => {
  // I should really be using the loader as planned, but yolo.
  onCompletion();
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
    super(loadTextureArray(`resources/bullet/${element}`, 6));
    this.play();
    this.isAlive = true;
    this.animationSpeed = BULLET_ANIMATION_SPEED;
    this.level = level;
    this.element = element;
    this.anchor.set(0.5, 0);
    Sound[`${this.element}_${this.level}`].play();
  }

  tick(delta) {
    const [dx, dy] = componenets(degToRad(this.angle) + Math.PI);
    this.x += dx * delta * BULLET_SPEED[this.level];
    this.y += dy * delta * BULLET_SPEED[this.level];
  }

  get zIndex() {
    return zIndex.bullet;
  }

  get collisionRadius() {
    return this.texture.width;
  }

  die() {
    // red bullets don't die.
    if (this.element === Element.red) {
      return;
    }
    this.isAlive = false;
    this.alpha = 0;
  }
}

class Enemy extends PIXI.AnimatedSprite {
  constructor(element, level, x, y) {
    const textureArrays = {
      alive: loadTextureArray(`resources/enemy/${element}-${level}`, 2),
      dead: [Texture.from(`resources/enemy/${element}-${level}/dead.png`)],
    };

    super(textureArrays.alive);
    this.play();

    this.blinks = 0;

    this.animationSpeed = ENEMY_ANIMATION_SPEED;

    this.textureArrays = textureArrays;

    this.anchor.set(0.5);
    this.x = x;
    this.y = y;

    this.element = element;
    this.level = level;
    this.hp = level;
  }

  get zIndex() {
    return this.isAlive ? this.level + zIndex.enemy : zIndex.corpse;
  }

  get collisionRadius() {
    return ENEMY_RADIUS[this.level];
  }

  tick(delta, state) {
    if (this.isAlive) {
      this.move(delta, state.player);
      this.collisionCheck(state.bullets);
      this.face(state.player.x, state.player.y);
      this.blink(delta);
    }
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

  get isAlive() {
    return this.hp > 0;
  }

  collisionCheck(bullets) {
    // corpses don't absorb bullets
    if (this.isAlive) {
      bullets.forEach((bullet) => {
        if (collide(this, bullet)) {
          this.takeDamage();
          bullet.die();
        }
      });
    }
  }

  takeDamage() {
    this.hp -= 1;
    if (!this.isAlive) {
      this.die();
    }
    this.blinks = ENEMY_BLINKS;
    this.blinkTimer = ENEMY_BLINK_DURATION;
  }

  blink(delta) {
    if (this.blinks === 0) {
      return;
    }

    this.alpha = this.blinks % 2 ? 1 : 0;

    if (this.blinkTimer <= 0) {
      this.blinks -= 1;
      this.blinkTimer = ENEMY_BLINK_DURATION;
    } else {
      this.blinkTimer -= delta;
    }
  }

  die() {
    this.hp = 0;
    this.textures = this.textureArrays.dead;
    this.gotoAndPlay(0);
    this.loop = false;
    this.alpha = 1;
    this.blinks = 0;
    this.angle = Math.random() * 360;
    Sound[`dead_1_${randInt(3) + 1}`].play();
  }
}

class Player extends PIXI.AnimatedSprite {
  constructor() {
    const enginesOff = [Texture.from('resources/player/ship/stopped.png')];
    super(enginesOff);

    this.zIndex = 100;

    this.isAlive = true;
    this.mode = Mode.ship;
    this.collisionRadius = PLAYER_RADIUS;

    this.animationSpeed = PLAYER_ANIMATION_SPEED;
    this.lastBulletFired = -PLAYER_COOLDOWN;
    this.turretTime = PLAYER_TURRET_TIME;

    this.element = Element.green;
    this.level = 1;

    this.textureArrays = {
      enginesOff,
      enginesOn: loadTextureArray('resources/player/ship', 1),
      turrets: {
        red: [Texture.from('resources/player/turret/red.png')],
        green: [Texture.from('resources/player/turret/green.png')],
        blue: [Texture.from('resources/player/turret/blue.png')],
      },
      dead: loadTextureArray('resources/player/dead', 8),
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

    this.turretTime -= delta;
    if ((this.mode === Mode.turret) && (this.turretTime < 0) && this.isAlive) {
      this.intoShip();
    }

    if (this.shouldShoot && (this.lastBulletFired + PLAYER_COOLDOWN < state.time)) {
      this.lastBulletFired = state.time;
      this.shouldShoot = false;
      state.addBullet(this.x, this.y, this.angle, this.element, this.level);
    }

    this.collisionCheck(state.enemies, state.time);
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
    console.log('engaging turret mode');

    this.mode = Mode.intoTurret;
    this.gotoAndStop(0);
    Sound.intoTurret.play();
    this.textures = this.textureArrays.intoTurret;
    this.loop = false;
    this.gotoAndPlay(0);
    this.onComplete = () => {
      // Not quite zero, so we can keep the same old angle.
      this.dx *= 0.00001;
      this.dy *= 0.00001;

      this.mode = Mode.turret;
      this.loop = true;

      this.turretTime = PLAYER_TURRET_TIME;
      this.element = element;
      this.level = level;
      this.textures = this.textureArrays.turrets[element];
    };
  }

  intoShip() {
    console.log('Returning to ship mode');
    this.mode = Mode.intoShip;
    this.textures = this.textureArrays.intoShip;
    this.loop = false;
    this.gotoAndPlay(0);

    Sound.intoShip.play();
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
      if (collide(this, enemy) && enemy.isAlive) {
        // This invalidates our iteration...
        this.shockwave(enemies);

        if (this.mode === Mode.ship) {
          this.intoTurret(enemy.element, enemy.level);
          enemy.die();
        } else if (this.mode === Mode.turret) {
          this.die();
        }
      }
    });
  }

  die() {
    this.isAlive = false;
    this.textures = this.textureArrays.dead;
    this.loop = false;
    this.mode = Mode.dying;
    this.animationSpeed = PLAYER_DEATH_ANIMATION_SPEED;
    this.onComplete = () => {
      this.mode = Mode.dead;
    };
    this.gotoAndPlay(0);
    console.log('YOU DIED!');
  }

  shockwave(enemies) {
    enemies.forEach((e) => {
      if (distance(e.x, e.y, this.x, this.y) <= PLAYER_SHOCKWAVE_RADIUS) {
        e.die();
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

class Spawner {
  constructor() {
    this.lastSpawn = -SPAWNER_COOLDOWN;
    this.cooldown = SPAWNER_COOLDOWN;
  }

  tick(delta, state) {
    if (this.lastSpawn + SPAWNER_COOLDOWN < state.time) {
      this.lastSpawn = state.time;
      this.cooldown *= SPAWNER_COOLDOWN_DELTA;
      this.cooldown = Math.max(SPAWNER_COOLDOWN_MIN, this.cooldown);

      const spawnCount = Math.floor(state.time / SPAWNER_COUNT_RATE) + 1;

      for (let i = 0; i < spawnCount; i += 1) {
        Spawner.spawn(state);
      }
    }
  }

  static randElement() {
    switch (randInt(3)) {
      case 1: return Element.red;
      case 2: return Element.blue;
      default: return Element.green;
    }
  }

  static randLevel() {
    return randInt(3) + 1;
  }

  static safeSpace(state) {
    // A random coord in the arena that isn't where the player or an enemy or
    // bullet is near.
    let attempts = 0;
    while (true) {
      const x = randInt(state.arena.width);
      const y = randInt(state.arena.height);

      if (distance(state.player.x, state.player.y, x, y) <= SPAWNER_SAFE_DISTANCE) {
        continue;
      }

      if (attempts >= SPAWNER_MAX_ATTEMPTS) {
        return [x, y];
      }

      attempts += 1;

      for (let i = 0; i < state.enemies.length; i += 1) {
        const enemy = state.enemies[i];
        if (distance(enemy.x, enemy.y, x, y) <= SPAWNER_SAFE_DISTANCE) {
          continue;
        }
      }

      return [x, y];
    }
  }


  static spawn(state) {
    if (!state.player.isAlive) {
      return;
    }

    const element = Spawner.randElement(state.time);
    const level = Spawner.randLevel(state.time);
    const [x, y] = Spawner.safeSpace(state);

    state.addEnemy(x, y, element, level);
  }
}

class State {
  constructor() {
    this.time = 0;

    const arena = new PIXI.AnimatedSprite(loadTextureArray('resources/arena', 1));
    arena.interactive = true;
    arena.sortableChildren = true;
    this.arena = arena;
    app.stage.addChild(this.arena);

    const player = new Player();
    this.player = player;
    arena.addChild(this.player);

    this.bullets = [];
    this.enemies = [];
    this.spawner = new Spawner();

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
    // const space = keyboard(' ');
    // space.press = player.toggleMode.bind(player);

    // bind player to pointer events
    arena.on('pointerdown', player.onPointerDown.bind(player));
    arena.on('pointermove', player.onPointerMove.bind(player));
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
    this.spawner.tick(delta, this);

    this.cullDeadSprites();
  }

  cullDeadSprites() {
    const stillEnemies = [];
    this.enemies.forEach((e) => {
      if (e.isAlive) {
        stillEnemies.push(e);
      }
    });
    this.enemies = stillEnemies;

    const stillBullets = [];
    this.bullets.forEach((e) => {
      if (e.isAlive) {
        stillBullets.push(e);
      }
    });
    this.bullets = stillBullets;
  }

  addBullet(x, y, angle, element, level) {
    const bullet = new Bullet(element, level);
    bullet.x = x;
    bullet.y = y;
    bullet.angle = angle;
    this.arena.addChild(bullet);
    this.bullets.push(bullet);
  }

  addEnemy(x, y, element, level) {
    const enemy = new Enemy(element, level, x, y);
    this.enemies.push(enemy);
    this.arena.addChild(enemy);
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
