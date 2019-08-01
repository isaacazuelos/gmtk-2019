'use strict'

// A game for the GMTK Game Jam 2019
//
// https://itch.io/jam/gmtk-2019
     
// Requires pixi.js in global scope

const { 
  utils, 
  Application, 
  Rectangle,
  Sprite,
  Text, 
  AnimatedSprite,
  Loader,
} = PIXI; 

const TextureCache = utils.TextureCache;

const color = {
  black: 0x000000,
  white: 0xFFFFFF,
  red: 0xFF0000,
};

const app = new Application({
  // Game Boy Advanced screen size in pixels
  width: 240,
  height: 160,
  resolution: 2,
});

app.renderer.backgroundColor = color.red;
PIXI.settings.SCALE_mode = PIXI.SCALE_MODES.NEAREST;

document.getElementById("game").appendChild(app.view);

Loader.shared
  .add('resources/spinner.png')
  .on('progress', (loader, resource) => {
    console.log("loading: " + resource.url);
    console.log("progress: " + loader.progress + "%");
  })
  .load(setup); // hoisting!

function setup() {

  let texture = TextureCache['resources/spinner.png'];  
  let rectangle = new Rectangle(0,0,16,16);
  
  texture.frame = rectangle
  let sprite = new Sprite(texture);
  
  sprite.x = 96;
  sprite.y = 96;
  
  app.stage.addChild(sprite);
};

app.start();
console.log("started!");

// Load a sprite and animate from texture

// Play a sound effect
