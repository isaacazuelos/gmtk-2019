/* eslint-disable no-param-reassign */
// A game for the GMTK Game Jam 2019
//
// https://itch.io/jam/gmtk-2019

// the code is bad, don't worry about it
/* eslint-disable no-continue */
/* eslint-disable no-undef */
/* eslint-disable no-case-declarations */

// # Constants

const {
  Application,
  Texture,
} = PIXI; // eslint-disable-line no-undef

// 16:9 ish version of NES vertical resolution
const FRAME_WIDTH = 600;
const FRAME_HEIGHT = 300;

const PLAYER_ANIMATION_SPEED = 0.5;
const PLAYER_DEATH_ANIMATION_SPEED = 0.1;
const PLAYER_THRUST = 1;
const PLAYER_MAX_MOVEMENT_SPEED = 2;
const PLAYER_FRICTION = 0.1;
const PLAYER_RADIUS = 7;
const PLAYER_SHOCKWAVE_RADIUS = 20;
const PLAYER_TURRET_TIME = 200;
const PLAYER_INTO_SHIP_WARNING_DURATION = 3 * 100;
const PLAYER_COOLDOWN = {
  green: [0, 16, 10, 10],
  red: [0, 24, 16, 10],
  blue: [0, 16, 12, 12],
};

const SHOCKWAVE_ANIMATION_SPEED = 0.5;

const ENEMY_ANIMATION_SPEED = 0.1;
const ENEMY_RADIUS = [0, 6, 7, 8];
const ENEMY_BASE_SPEED = [0, 0.75, 0.5, 0.3];
const ENEMY_COURAGE_BOOST = 2;
const ENEMY_BLINKS = 4; // must be even
const ENEMY_BLINK_DURATION = 5;
const ENEMY_WIGGLE_DEGREES = [0, 15, 30, 45];
const ENEMY_WIGGLE_PERIOD = [0, 3, 5, 8];

const BULLET_SPEED = [0, 1.5, 2, 2.5];
const BULLET_ANIMATION_SPEED = 0.25;
const BULLET_BURST_COUNT = 8;
const BULLET_TRIPLE_SHIFT = 5;
const BULLET_MAX_BOUNCE = 2;

const SPAWNER_COOLDOWN = 100;
const SPAWNER_COOLDOWN_DELTA = 0.90;
const SPAWNER_COOLDOWN_MIN = 20;
const SPAWNER_SAFE_DISTANCE = 64;
const SPAWNER_MAX_ATTEMPTS = 32;
const SPAWNER_COUNT_RATE = 2000;
const SPAWNER_NEW_ENEMY_GATE = 550;
const SPAWNER_NEW_LEVEL_GATE = 300;

const zIndex = {
  player: 100,
  shockwave: 50,
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
  const dx = -Math.sin(theta);
  const dy = Math.cos(-theta);
  return [dx, dy];
};

const reflectV = deg => -deg;
const reflectH = deg => 180 - deg;

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
  blueDeath: PIXI.sound.Sound.from('resources/sounds/blueDeath.mp3'),
  dead_1: PIXI.sound.Sound.from('resources/sounds/dead-1.mp3'),
  dead_2: PIXI.sound.Sound.from('resources/sounds/dead-2.mp3'),
  dead_3: PIXI.sound.Sound.from('resources/sounds/dead-3.mp3'),
  deadPlayer: PIXI.sound.Sound.from('resources/sounds/deadPlayer.mp3'),
  green_1: PIXI.sound.Sound.from('resources/sounds/green-1.mp3'),
  green_2: PIXI.sound.Sound.from('resources/sounds/green-2.mp3'),
  green_3: PIXI.sound.Sound.from('resources/sounds/green-3.mp3'),
  intoShip: PIXI.sound.Sound.from('resources/sounds/intoShip.mp3'),
  intoTurret: PIXI.sound.Sound.from('resources/sounds/intoTurret.mp3'),
  red_1: PIXI.sound.Sound.from('resources/sounds/red-1.mp3'),
  red_2: PIXI.sound.Sound.from('resources/sounds/red-2.mp3'),
  red_3: PIXI.sound.Sound.from('resources/sounds/red-3.mp3'),
  warning: PIXI.sound.Sound.from('resources/sounds/warning.mp3'),
  intro: PIXI.sound.Sound.from('resources/music/intro.mp3'),
  loop: PIXI.sound.Sound.from('resources/music/loop.mp3'),
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
    this.bounces = 0;
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

    // try to bounce
    if ((this.element === Element.red)
      && (this.level === 3)
      && (this.bounces < BULLET_MAX_BOUNCE)
    ) {
      if (this.x <= 0 || this.x >= FRAME_WIDTH) {
        this.bounces += 1;
        this.angle = reflectV(this.angle);
      } else if (this.y <= 0 || this.y >= FRAME_HEIGHT) {
        this.bounces += 1;
        this.angle = reflectH(this.angle);
      }

      this.x = clamp(0, this.x, FRAME_WIDTH);
      this.y = clamp(0, this.y, FRAME_HEIGHT);
    }
  }

  get zIndex() {
    const bonus = (this.element === Element.blue ? 1 : 0);
    return zIndex.bullet + bonus;
  }

  get collisionRadius() {
    return this.texture.width;
  }

  die() {
    // red bullets don't die.
    if (this.element === Element.red && this.level >= 2) {
      return;
    }

    this.isAlive = false;
    this.visible = false;
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
      this.move(delta, state);
      this.collisionCheck(state);
      this.face(state.player.x, state.player.y);
      this.blink(delta);
    }
  }

  move(delta, state) {
    if (this.element === Element.blue) {
      this.moveEvasively(delta, state.player);
    } else if (this.element === Element.green) {
      this.moveToward(delta, state.player);
    } else { // red
      this.wiggleTowards(delta, state);
    }

    this.x = clamp(8, this.x, FRAME_WIDTH - 8);
    this.y = clamp(8, this.y, FRAME_HEIGHT - 8);
  }

  wiggleTowards(delta, { player, time }) {
    const toPlayer = angleTo(this.x, this.y, player.x, player.y);
    const wiggleIntensity = degToRad(ENEMY_WIGGLE_DEGREES[this.level]);
    const wiggleAngle = Math.sin(time / ENEMY_WIGGLE_PERIOD[this.level]);
    const wiggle = wiggleIntensity * wiggleAngle;

    const [dx, dy] = componenets(toPlayer + wiggle);

    this.x += dx * delta * ENEMY_BASE_SPEED[this.level];
    this.y += dy * delta * ENEMY_BASE_SPEED[this.level];
  }

  moveEvasively(delta, player) {
    const toPlayer = angleTo(this.x, this.y, player.x, player.y);
    const [dx, dy] = componenets(toPlayer);

    const playerHeading = degToRad(player.angle);

    const theta = playerHeading - toPlayer;

    let fearFactor = -Math.cos(theta);
    if (fearFactor >= 0) {
      fearFactor *= ENEMY_COURAGE_BOOST;
    }

    this.x += dx * delta * ENEMY_BASE_SPEED[this.level] * fearFactor;
    this.y += dy * delta * ENEMY_BASE_SPEED[this.level] * fearFactor;
  }

  moveToward(delta, player) {
    const toPlayer = angleTo(this.x, this.y, player.x, player.y);
    const [dx, dy] = componenets(toPlayer);

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

  collisionCheck(state) {
    // corpses don't absorb bullets
    if (this.isAlive) {
      state.bullets.forEach((bullet) => {
        if (collide(this, bullet)) {
          this.takeDamage(bullet, state);
          bullet.die();
        }
      });
    }
  }

  takeDamage(bullet, state) {
    this.hp -= 1;
    state.points += 1;
    if (!this.isAlive) {
      this.die(bullet.element);
      const shouldExplode = (bullet.element === Element.blue) && (bullet.level === 3);
      if (shouldExplode) {
        state.addBulletBurst(this.x, this.y, this.angle, this.element, bullet.level);
      }
    }
    this.blinks = ENEMY_BLINKS;
    this.blinkTimer = ENEMY_BLINK_DURATION;
  }

  blink(delta) {
    if (this.blinks === 0) {
      return;
    }

    this.visible = Boolean(this.blinks % 2);

    if (this.blinkTimer <= 0) {
      this.blinks -= 1;
      this.blinkTimer = ENEMY_BLINK_DURATION;
    } else {
      this.blinkTimer -= delta;
    }
  }

  die(element) {
    this.hp = 0;
    this.textures = this.textureArrays.dead;
    this.gotoAndPlay(0);
    this.loop = false;

    // stay visible, damn it!
    this.visible = 1;
    this.blinks = 0;
    this.blinkTimer = 0;

    this.angle = Math.random() * 360;

    if (element === Element.blue) {
      Sound.blueDeath.play();
    } else {
      Sound[`dead_${randInt(3) + 1}`].play();
    }
  }
}

class Player extends PIXI.AnimatedSprite {
  constructor() {
    const enginesOff = [Texture.from('resources/player/ship/stopped.png')];
    super(enginesOff);

    this.zIndex = 100;

    this.tapLocation = null;

    this.isAlive = true;
    this.mode = Mode.ship;
    this.collisionRadius = PLAYER_RADIUS;

    this.warningPlayed = true;

    this.element = Element.green;
    this.level = 1;

    this.animationSpeed = PLAYER_ANIMATION_SPEED;
    this.turretTime = PLAYER_TURRET_TIME;
    this.lastBulletFired = -PLAYER_COOLDOWN[Element.green][0];

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

  get cooldown() {
    return PLAYER_COOLDOWN[this.element][this.level];
  }

  tick(delta, state) {
    if (this.mode === Mode.ship) {
      this.move(delta);
      this.rotate();
      this.updateEngineState();
    }

    this.turretTime -= delta;
    if (this.turretTime <= PLAYER_INTO_SHIP_WARNING_DURATION && !this.warningPlayed) {
      Sound.warning.play();
      this.warningPlayed = true;
    }

    if ((this.mode === Mode.turret) && (this.turretTime < 0) && this.isAlive) {
      this.intoShip();
    }

    if (this.shouldShoot && (this.lastBulletFired + this.cooldown < state.time)) {
      this.shoot(state);
    }

    this.collisionCheck(state);
  }

  shoot(state) {
    this.lastBulletFired = state.time;
    this.shouldShoot = false;

    if (this.element === Element.blue && this.level >= 2) {
      state.addBulletBurst(this.x, this.y, this.angle, this.element, this.level);
    } else if (this.element === Element.green && this.level === 3) {
      state.addTripleShot(this.x, this.y, this.angle, this.element, this.level);
    } else {
      state.addBullet(this.x, this.y, this.angle, this.element, this.level);
    }
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
    this.warningPlayed = false;
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

  collisionCheck(state) {
    state.enemies.forEach((enemy) => {
      if (collide(this, enemy) && enemy.isAlive) {
        if (this.mode === Mode.ship) {
          this.intoTurret(enemy.element, enemy.level);
          state.addShockwave(enemy.element);
          enemy.die();
        } else if (this.mode === Mode.turret) {
          this.die();
        }
      }
    });
  }

  die() {
    this.isAlive = false;
    Sound.deadPlayer.play();
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

  static pickElement(time) {
    switch (randInt(Math.min(Math.floor(time / SPAWNER_NEW_ENEMY_GATE), 3))) {
      case 1: return Element.red;
      case 2: return Element.blue;
      default: return Element.green;
    }
  }

  static pickLevel(time) {
    return randInt(Math.min(Math.floor(time / SPAWNER_NEW_LEVEL_GATE), 3)) + 1;
  }

  static safeSpace(state) {
    // A random coord in the arena that isn't where the player or an enemy or
    // bullet is near.
    let attempts = 0;

    // eslint-disable-next-line no-constant-condition
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

    const element = Spawner.pickElement(state.time);
    const level = Spawner.pickLevel(state.time);
    const [x, y] = Spawner.safeSpace(state);

    state.addEnemy(x, y, element, level);
  }
}

// Note these are zero-indexed, unlike the frame texture files.
const Cards = {
  title: 0,
  paused: 1,
  gameOver: 2,
};

class State {
  constructor() {
    this.time = 0;
    this.paused = true;
    this.points = 0;

    const arena = new PIXI.AnimatedSprite(loadTextureArray('resources/arena', 1));
    arena.interactive = true;
    arena.sortableChildren = true;
    this.arena = arena;
    app.stage.addChild(this.arena);

    const pointsLabel = new PIXI.Text(`points: ${this.points}`, {
      fontSize: 10,
      fontFamily: 'Courier',
    });
    this.pointsLabel = pointsLabel;
    app.stage.addChild(this.pointsLabel);

    const cards = new PIXI.AnimatedSprite(loadTextureArray('resources/cards', 2));
    cards.gotoAndStop(Cards.title);
    cards.anchor.set(0.5);
    cards.x = FRAME_WIDTH / 2;
    cards.y = FRAME_HEIGHT / 2;
    this.cards = cards;
    arena.addChild(cards);

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

    // reset the game state
    const r = keyboard('r');
    r.press = this.reset.bind(this);

    const p = keyboard('p');
    p.press = this.togglePause.bind(this);

    // bind player to pointer events
    arena.on('pointerdown', this.onPointerDown.bind(this));
    arena.on('pointermove', this.onPointerMove.bind(this));

    // start music
    Sound.intro.play(() => {
      Sound.loop.loop = true;
      Sound.loop.play();
    });
  }

  togglePause() {
    if (this.paused) {
      this.cards.gotoAndStop(1);
      this.cards.visible = false;
      this.paused = false;
    } else {
      this.cards.gotoAndStop(1);
      this.cards.visible = true;
      this.paused = true;
    }
  }

  reset() {
    // No way this isn't leaking, yolo
    this.time = 0;
    this.points = 0;
    this.bullets = [];
    this.enemies = [];
    this.player = new Player();
    this.spawner = new Spawner();

    while (this.arena.children[0]) {
      this.arena.removeChild(this.arena.children[0]);
    }

    this.arena.addChild(this.player);
    this.arena.addChild(this.cards);

    this.cards.visible = true;

    if (!this.paused) {
      this.togglePause();
    }

    this.cards.gotoAndStop(Cards.title);
  }

  // this could have been done better...

  onPointerDown(e) {
    if (this.cards.visible) {
      this.cards.visible = false;
    }

    if (this.paused) {
      this.paused = false;
    }

    this.player.onPointerDown(e);
  }

  onPointerMove(e) {
    this.player.onPointerMove(e);
  }

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
    if (this.paused) {
      return;
    }

    if (!this.player.isAlive && !this.paused) {
      this.paused = true;
      this.cards.gotoAndStop(Cards.gameOver);
      this.cards.visible = true;
    }

    this.time += delta;
    this.player.tick(delta, this);

    this.pointsLabel.text = `points: ${this.points}`;

    // is this good?
    if (this.player.isAlive) {
      this.bullets.forEach(b => b.tick(delta));
      this.enemies.forEach(e => e.tick(delta, this));
      this.spawner.tick(delta, this);
    }

    this.cullDeadSprites();
  }

  cullDeadSprites() {
    const stillEnemies = [];
    this.enemies.forEach((e) => {
      if (e.isAlive) {
        stillEnemies.push(e);
      } else {
        e.visible = true;
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
    this.bullets.push(bullet);
    this.arena.addChild(bullet);
  }

  addBulletBurst(x, y, sourceAngle, element, level) {
    for (let angle = 0; angle < 360; angle += (360 / BULLET_BURST_COUNT)) {
      this.addBullet(x, y, sourceAngle + angle, element, level);
    }
  }

  addTripleShot(x, y, angle, element, level) {
    this.addBullet(x, y, angle, element, level);
    this.addBullet(x, y, angle + BULLET_TRIPLE_SHIFT, element, level);
    this.addBullet(x, y, angle - BULLET_TRIPLE_SHIFT, element, level);
  }

  addShockwave(element) {
    const textures = loadTextureArray(`resources/shockwave/${element}`, 4);
    const shockwave = new PIXI.AnimatedSprite(textures);
    shockwave.zIndex = zIndex.shockwave;
    shockwave.loop = false;
    shockwave.animationSpeed = SHOCKWAVE_ANIMATION_SPEED;
    shockwave.anchor.set(0.5);
    shockwave.x = this.player.x;
    shockwave.y = this.player.y;

    this.arena.addChild(shockwave);
    shockwave.gotoAndPlay(0);

    shockwave.onComplete = () => {
      shockwave.visible = false;
      this.arena.removeChild(shockwave);
    };

    this.enemies.forEach((enemy) => {
      if (distance(enemy.x, enemy.y, this.player.x, this.player.y) <= PLAYER_SHOCKWAVE_RADIUS) {
        enemy.die();
      }
    });
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
