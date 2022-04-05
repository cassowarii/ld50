"use strict";

window.requestAnimFrame = (function() {
    return window.requestAnimationFrame      ||
        window.webkitRequestAnimationFrame   ||
        window.mozRequestAnimationFrame      ||
        window.oRequestAnimationFrame        ||
        window.msRequestAnimationFrame       ||
        function(callback, element) {
            window.setTimeout(callback, 1000/60);
        };
})();

let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 600;

/*let title_bgm;
let ingame_bgm;
let bgm;*/
let audiocheck = document.createElement('audio');

let bgm;

let sfx = {
    lap: new Audio('sfx/lap.wav'),
    splash: new Audio('sfx/splash.wav'),
    jump: new Audio('sfx/jump.wav'),
    land: new Audio('sfx/land.wav'),
    die: new Audio('sfx/die.wav'),
};
sfx.lap.volume = 0.7;
sfx.splash.volume = 0.7;
sfx.die.volume = 0.5;
sfx.jump.volume = 0.85;
sfx.land.volume = 0.85;

function playSfx(name) {
    if (!muted) {
        sfx[name].currentTime = 0;
        sfx[name].play();
    }
}

function goodmod(x, n) {
     return ((x%n)+n)%n;
}

let won = false;

let objs = [];

let tiles;
let height_tiles;
let character_img;
let objs_img;
let numerals_img;
let raindrop_img;
let clickstart_img;

let level_images = [];
let end_img;

let bg_color = '92, 136, 234';

let tile_size = 16;
let tile_height = 5;
let draw_scale = 4;
let level_w = 14;
let level_h = 11;

let canvas_w = level_w * tile_size + 1;
let canvas_h = level_h * tile_size + 1;

let level_number = 0;

let elevation_map; /* elevation map */

let numeral_locations;

let framestep = 1000/60;

let canvas;
let global_ctx; /* context for the actual real canvas */
let mask_ctx;   /* context for drawing the transition mask, gets scaled up */
let copy_ctx;   /* context for copying the old screen on transition */
let draw_ctx;   /* context for drawing the real level */

let char_anims = {
    stand_right:    { frame_length: 1000, frames: [0] },
    stand_left:     { frame_length: 1000, frames: [4] },
    stand_down:     { frame_length: 1000, frames: [8] },
    stand_up:       { frame_length: 1000, frames: [12] },
    walk_right:     { frame_length: 175, frames: [1, 2, 3, 0] },
    walk_left:      { frame_length: 175, frames: [5, 6, 7, 4] },
    walk_down:      { frame_length: 175, frames: [9, 10, 11, 8] },
    walk_up:        { frame_length: 175, frames: [13, 14, 15, 12] },
    hop_right:      { frame_length: 1000, frames: [16] },
    hop_left:       { frame_length: 1000, frames: [17] },
    hop_down:       { frame_length: 1000, frames: [18] },
    hop_up:         { frame_length: 1000, frames: [19] },
    hopalt_right:   { frame_length: 1000, frames: [20] },
    hopalt_left:    { frame_length: 1000, frames: [21] },
    hopalt_down:    { frame_length: 1000, frames: [22] },
    hopalt_up:      { frame_length: 1000, frames: [23] },
    climb_up:       { frame_length: 175, frames: [24, 25] },
    boat_right:     { frame_length: 400, frames: [26, 27] },
    sink_up:        { frame_length: 200, frames: [28, 29, 30, 31, 32], noloop: true },
    sink_down:      { frame_length: 200, frames: [28, 29, 30, 31, 32], noloop: true },
    sink_left:      { frame_length: 200, frames: [28, 29, 30, 31, 32], noloop: true },
    sink_right:     { frame_length: 200, frames: [28, 29, 30, 31, 32], noloop: true },
};

let UIState = { INGAME: 0, TRANSITION: 1 };

let ui_state;

let TransitionType = { DOTS: 1, SLIDE_DOWN: 2, SLIDE_UP: 3, FADE: 4 };

let DOT_TRANSITION_LENGTH = 800;
let TRANSITION_DOT_LENGTH = 300;
let SLIDE_TRANSITION_LENGTH = 400;
let FADE_TRANSITION_LENGTH = 600;
let FAST_FADE_TRANSITION_LENGTH = 100;

let transition = {
    is_transitioning: false,
    timer: 0,
    color: '#000000',
    w: 20,
    h: 14,
    dir_invert_v: false,
    dir_invert_h: false,
    invert_shape: true,
    mid_long: false,
    done_func: null,
    goal_state: UIState.TITLESCREEN,
    type: TransitionType.DOTS,
    nodraw: false,
}

function long_transition(callback) {
    if (transition.is_transitioning) return;

    draw();

    transition.invert_shape = false;
    ui_state = UIState.TRANSITION;
    _internal_start_transition(function() {
        transition.mid_long = true;
    }, function() {
        transition.invert_shape = true;
        transition.is_transitioning = true;
        let tdiv = transition.dir_invert_v;
        let tdih = transition.dir_invert_h;
        _internal_start_transition(function() {
            transition.mid_long = false;
            callback();
            transition.dir_invert_v = tdiv;
            transition.dir_invert_h = tdih;
        });
    });
}

function start_transition(callback, on_done) {
    if (transition.is_transitioning) return;
    if (!transition.nodraw) draw();

    _internal_start_transition(callback, on_done);
}

function _internal_start_transition(callback, on_done) {
    if (on_done) {
        transition.done_func = on_done;
    }

    if (transition.type == TransitionType.DOTS) {
        transition.end_time = DOT_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.SLIDE_DOWN || transition.type == TransitionType.SLIDE_UP) {
        transition.end_time = SLIDE_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.FADE) {
        transition.end_time = FADE_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.FAST_FADE) {
        transition.end_time = FAST_FADE_TRANSITION_LENGTH;
    }

    copy_ctx.drawImage(draw_ctx.canvas, 0, 0);

    transition.dir_invert_v = Math.random() < 0.5;
    transition.dir_invert_h = Math.random() < 0.5;

    callback();

    if (ui_state != UIState.TRANSITION) {
        transition.goal_state = ui_state;
    }

    transition.is_transitioning = true;
    transition.timer = 0;
}

function finish_transition() {
    transition.is_transitioning = false;
    transition.timer = 0;
    ui_state = transition.goal_state;

    if (transition.done_func) {
        transition.done_func();
        transition.done_func = null;
    }
}

function save() {
    let save_data = JSON.stringify({ show: map_info.show, complete: map_info.complete, best: map_info.furthest_map });
    localStorage.setItem("casso.greatflood.save", save_data);
}

/* state:
 * STAND: waiting for input
 * MOVE: moving
 * HOP: jumping between levels
 * CLIMB: climbing ladder
 * OBJFALL: object falling
 * BOAT: won the game
 * PLOOP: died
 * TRANSITION: doing a screen transition
 */
let State = { STAND: 0, MOVE: 1, HOP: 2, CLIMB: 3, OBJFALL: 4, BOAT: 5, PLOOP: 6, TRANSITION: 7 };

let game_state = State.STAND;

let started = false;

let muted = false;

function toggle_mute() {
    muted = !muted;
    if (muted) {
        bgm.pause();
    } else {
        bgm.play();
    }
    save_muted();
}

ready(function() {
    canvas = document.getElementById('canvas');
    global_ctx = canvas.getContext('2d');
    global_ctx.imageSmoothingEnabled = false;
    global_ctx.webkitImageSmoothingEnabled = false;
    global_ctx.mozImageSmoothingEnabled = false;

    let mask_canvas = document.createElement('canvas');
    mask_ctx = mask_canvas.getContext('2d');
    mask_ctx.imageSmoothingEnabled = false;
    mask_ctx.webkitImageSmoothingEnabled = false;
    mask_ctx.mozImageSmoothingEnabled = false;

    let copy_canvas = document.createElement('canvas');
    copy_ctx = copy_canvas.getContext('2d');
    copy_ctx.imageSmoothingEnabled = false;
    copy_ctx.webkitImageSmoothingEnabled = false;
    copy_ctx.mozImageSmoothingEnabled = false;

    let draw_canvas = document.createElement('canvas');
    draw_ctx = draw_canvas.getContext('2d');
    draw_ctx.imageSmoothingEnabled = false;
    draw_ctx.webkitImageSmoothingEnabled = false;
    draw_ctx.mozImageSmoothingEnabled = false;

    tiles = new Image();
    height_tiles = new Image();
    character_img = new Image();
    objs_img = new Image();
    numerals_img = new Image();
    raindrop_img = new Image();
    end_img = new Image();

    tiles.src = 'tiles.png';
    height_tiles.src = 'height-tiles.png';
    character_img.src = 'frog.png'
    objs_img.src = 'objs.png'
    numerals_img.src = 'roman_numerals.png';
    raindrop_img.src = 'raindrop.png';

    for (let i = 0; i < 12; i++) {
        let im = new Image();
        im.src = 'level-images/' + i + '.png';
        level_images.push(im);
    }
    end_img.src = 'the-end.png';

    if (audiocheck.canPlayType('audio/mpeg')) {
        bgm = new Audio('music/music.mp3');
    } else if (audiocheck.canPlayType('audio/ogg')) {
        bgm = new Audio('music/music.ogg');
    }

    bgm.volume = 0.3;
    bgm.loop = true;

    //ui_state = UIState.SPLASH;
    ui_state = UIState.INGAME;

    //let save_data = JSON.parse(localStorage.getItem("casso.greatflood.save") || JSON.stringify(default_save));

    draw_ctx.fillStyle = 'rgb(0, 0, 0)';
    draw_ctx.fillRect(0, 0, level_w * tile_size, level_h * tile_size);

    transition.nodraw = true;
    transition.type = TransitionType.FADE;
    start_transition(load_level);
    transition.nodraw = false;

    clickstart_img = new Image();
    clickstart_img.src = 'clicktostart.png';

    loop();
});

function initialize() {
    started = true;
    ui_state = UIState.INGAME;
    //if (!muted) bgm.play();
}

let ID = {
    frog: 0,
    finish: 1,
    ironbox: 2,
    ladder: 3,
    woodbox: 4,
    boat: 5,
};

let objheights = {
    [ID.ironbox]: 2 * tile_height,
    [ID.woodbox]: 2 * tile_height,
    [ID.boat]: 1,
}

let floats = {
    [ID.woodbox]: true,
    [ID.boat]: true,
}

let isbox = {
    [ID.ironbox]: true,
    [ID.woodbox]: true,
}

let keep_going = true;
let last_frame_time;
let timedelta = 0;
function loop(timestamp) {
    if (timestamp == undefined) {
        timestamp = 0;
        last_frame_time = timestamp;
    }
    timedelta += timestamp - last_frame_time;
    last_frame_time = timestamp;

    while (timedelta >= framestep) {
        update(framestep);
        timedelta -= framestep;
    }
    draw();

    if (keep_going) {
        requestAnimFrame(loop);
    }
}

function save_undo_state() {
    let objs_copy = [];
    for (let o of objs) {
        objs_copy.push({
            x: o.x,
            y: o.y,
            z: o.z,
            stable: o.stable,
            target_x: o.x,
            target_y: o.y,
            id: o.id,
        });
    }

    undo_stack.push({
        x: character.x,
        y: character.y,
        z: character.z,
        dir: character.direction,
        water_level: water_level,
        objs: objs_copy,
    });
}

function undo() {
    console.log('undo');
    if (undo_stack.length > 0) {
        let undo_entry = undo_stack.pop();
        character.x = undo_entry.x;
        character.y = undo_entry.y;
        character.z = undo_entry.z;
        character.direction = undo_entry.dir;

        objs = undo_entry.objs;

        water_level = undo_entry.water_level;

        game_state = State.STAND;
        character.move_fraction = 0;
        switch_char_anim('stand');
        for (let o of objs) {
            o.move_fraction = 0;
            o.zspeed = 0;
        }
    }
}

function elev_at(x, y) {
    /* in this game, the outside is impassable/indestructible */
    if (y == level_h) {
        y = level_h - 1;
    }
    if (x < 0 || x >= level_w || y < 0 || y >= level_h) {
        return 0;
    }
    return elevation_map[y * level_w + x] * tile_height;
}

document.onmousedown = function() {
    can_go = true;
    bgm.play();
}

function dynamic_elev_at(x, y) {
    return dynamic_elev_below(null, x, y);
}

function dynamic_elev_below(z, x, y) {
    let tile_objs = objs_at(x, y);
    let elev = elev_at(x, y);
    for (let o of tile_objs) {
        if (z !== null && o.z >= z) {
            continue;
        }
        if (o.move_fraction) continue;
        if (o.z + objheights[o.id] > elev) {
            elev = o.z + objheights[o.id];
        }
    }
    return elev;
}

function objs_at(x, y) {
    return objs.filter(o => o.x == x && o.y == y);
}

let keys_down = {
    left:   false,
    right:  false,
    up:     false,
    down:   false,
};

document.onkeydown = function(e) {
    if (transition.is_transitioning || ui_state == UIState.TRANSITION) return;

    if (e.keyCode >= 37 && e.keyCode <= 40) {
        switch (e.keyCode) {
            case 37:
                keys_down.left = true;
                break;
            case 38:
                keys_down.up = true;
                break;
            case 39:
                keys_down.right = true;
                break;
            case 40:
                keys_down.down = true;
                break;
        }
        e.preventDefault();
    }

    if (e.keyCode == 90 || e.keyCode == 27 || e.keyCode == 82 || e.keyCode == 77) {
        e.preventDefault();
    }
}

document.onkeyup = function(e) {
    if (transition.is_transitioning || ui_state == UIState.TRANSITION) return;

    if (e.keyCode == 90) {
        if (ui_state == UIState.INGAME) {
            transition.type = TransitionType.FAST_FADE;
            start_transition(undo);
        }
    }

    if (e.keyCode == 82) {
        if (ui_state == UIState.INGAME) {
            transition.type = TransitionType.FADE;
            start_transition(reset);
        }
    }

    if (e.keyCode == 27) {
        if (ui_state == UIState.INGAME) {
            transition.type = TransitionType.DOTS;
            long_transition(return_to_map);
        }
    }

    if (e.keyCode == 77) {
        toggle_mute();
        save_mute();
    }

    if (e.keyCode == 37) {
        keys_down.left = false;
    }
    if (e.keyCode == 38) {
        keys_down.up = false;
    }
    if (e.keyCode == 39) {
        keys_down.right = false;
    }
    if (e.keyCode == 40) {
        keys_down.down = false;
    }
}

let hop_alt = false;

let water_level = 0;

let can_go = false;

function do_move(dx, dy) {
    if (!can_go) return;

    if (game_state == State.OBJFALL) return;

    character.target_x = character.x + dx;
    character.target_y = character.y + dy;

    if (dx > 0) {
        character.direction = 'right';
    } else if (dx < 0) {
        character.direction = 'left';
    } else if (dy > 0) {
        character.direction = 'down';
    } else if (dy < 0) {
        character.direction = 'up';
    }

    let current_height = dynamic_elev_at(character.x, character.y);
    let target_height = dynamic_elev_at(character.target_x, character.target_y);

    let has_ladder = objs_at(character.x, character.y).filter(o => o.id == ID.ladder).length > 0;
    let has_box = objs_at(character.target_x, character.target_y).filter(o => isbox[o.id]).length > 0;

    if (target_height - current_height > tile_height + 1) {
        /* If too high, don't do it... unless we're facing up and have a ladder */
        if (character.direction === 'up' && has_ladder) {
            game_state = State.CLIMB;
            switch_char_anim('climb');
            return true;
        } else if (target_height - current_height <= 2 * tile_height && target_height - current_height > 0 && has_box) {
            let box = objs_at(character.target_x, character.target_y).filter(
                o => isbox[o.id] && character.z - o.z < tile_height && character.z >= o.z && o.stable
            )[0];
            if (box) {
                let move_obj_result = do_move_obj(box, dx, dy);
                if (move_obj_result) {
                    game_state = State.MOVE;
                    switch_char_anim('walk');
                    return true;
                } else {
                    switch_char_anim('stand');
                    character.target_x = character.x;
                    character.target_y = character.y;
                    console.log("Cancelled because there's something in the way of the box");
                    return false;
                }
            } else {
                console.log("Cancelled because no actual box :< you liar");
                game_state = State.STAND;
                return false;
            }
        } else {
            character.target_x = character.x;
            character.target_y = character.y;
            switch_char_anim('stand');
            console.log("Cancelled because too tall w/ no extenuating circumstances");
            return false;
        }
    }

    if (target_height <= water_level) {
        /* Don't move to places that are underwater */
        character.target_x = character.x;
        character.target_y = character.y;
        switch_char_anim('stand');
        console.log("Cancelled because that's underwater");
        return false;
    }

    if (current_height == target_height) {
        game_state = State.MOVE;
        character.anim = 'walk';
    } else if (current_height > target_height) {
        game_state = State.HOP;
        character.move_fraction = 0;
        character.zspeed = 80;
        playSfx('jump');
        hop_alt = !hop_alt;
        if (hop_alt) {
            switch_char_anim('hopalt');
        } else {
            switch_char_anim('hop');
        }
    } else if (current_height < target_height) {
        game_state = State.HOP;
        character.move_fraction = 0;
        character.zspeed = 100;
        playSfx('jump');
        hop_alt = !hop_alt;
        if (hop_alt) {
            switch_char_anim('hopalt');
        } else {
            switch_char_anim('hop');
        }
    }

    return true;
}

function do_move_obj(obj, dx, dy) {
    obj.target_x = obj.x + dx;
    obj.target_y = obj.y + dy;
    obj.zspeed = 0;
    let current_height = dynamic_elev_below(obj.z, obj.x, obj.y);
    let target_height = dynamic_elev_at(obj.target_x, obj.target_y);

    if (current_height >= target_height) {
        obj.move_fraction = 0;
        return true;
    } else {
        obj.target_x = obj.x;
        obj.target_y = obj.y;
        return false;
    }
}


/*function swap_bgm(new_bgm) {
    bgm.pause();
    bgm = new_bgm;
    //bgm.currentTime = 0;
    if (!muted) {
        bgm.play();
    }
}*/

let cancel_char_anim = false;

function reset() {
    load_level();
    character.anim_frame_index = 0;
    character.frame_time = 0;
    character.anim = 'stand';
    game_state = State.STAND;
    water_level = 0;
}

function load_level() {
    if (level_number > levels.length) {
        win();
    } else {
        load_level_data(levels[level_number]);
    }
}

let undo_stack = [];

function load_level_data(lvl) {
    objs = [];
    elevation_map = [];
    numeral_locations = {};
    for (let l of lvl.elevation) {
        elevation_map.push(l);
    }

    for (let o of lvl.objs) {
        if (o.id == ID.frog) {
            character.x = o.x;
            character.y = o.y;
            character.z = elev_at(o.x, o.y);
        } else {
            let new_obj = {
                id: o.id,
                x: o.x,
                y: o.y,
                z: elev_at(o.x, o.y),
                stable: true,
            };
            objs.push(new_obj);
        }
    }

    for (let n of lvl.numerals) {
        numeral_locations["" + n.x + "," + n.y] = true;
    }

    //let charPos = level.indexOf(-1);
    //level[charPos] = 0;
    //character.x = charPos % level_w;
    //character.y = Math.floor(charPos / level_w);

    game_state = State.STAND;
    undo_stack = [];
    won_level = false;

    keys_down = { left: false, right: false, up: false, down: false };
    character.move_fraction = 0;

    if (level_number == 0) {
        character.direction = 'left';
    } else if (character.x == 1) {
        character.direction = 'right';
    } else if (character.y == 1) {
        character.direction = 'down';
    } else if (character.x == level_w - 2) {
        character.direction = 'left';
    } else if (character.y == level_h - 1) {
        character.direction = 'up';
    }
}

let char_anim_size = {
    w: 16,
    h: 48,
    offset_x: 1,
    offset_y: 26,
}

let character = {
    x: 1,
    y: 7,
    z: tile_height,
    zspeed: 0,
    target_x: 3,
    target_y: 4,
    frame: 0,
    frame_time: 0,
    anim_frame_index: 0,
    anim: 'stand',
    move_fraction: 0,
    direction: 'down',
}

let won_level = false;
let won_game = false;

function win() {
    won_level = true;
}

const CHARACTER_WALK_SPEED = 48;
const CHARACTER_CLIMB_SPEED = 48;
const BOAT_SPEED = 2;

let end_timer;
const END_DELAY = 3.5;
const END_FADE_TIME = 2;

function get_current_char_anim() {
    return char_anims[character.anim + '_' + character.direction];
}

function switch_char_anim(anim_name) {
    character.anim = anim_name;
    character.anim_frame_index = 0;
    character.frame_time = 0;
}

function on_enter_tile() {
    if (level_number != 11) {
        water_level ++;
        if (water_level % tile_height == 0) {
            playSfx('lap');
        }
    }

    for (let o of objs) {
        /* Floating objects... well... float */
        if (floats[o.id] && o.z + objheights[o.id] <= water_level) {
            o.z = water_level - objheights[o.id] + 1;
            o.zspeed = 0;
        } else if (o.stable) {
            o.z = dynamic_elev_below(o.z, o.x, o.y);
            o.zspeed = 0;
        }
    }

    character.z = dynamic_elev_at(character.x, character.y);

    let tile_objs = objs_at(character.x, character.y);
    for (let o of tile_objs) {
        if (o.id == ID.finish) {
            console.log("Level complete!");
            transition.type = TransitionType.FADE;
            start_transition(next_level);
        }
        if (o.id == ID.boat) {
            won_game = true;
            o.hide = true;
            o.move_fraction = 0;
            game_state = State.BOAT;
            end_timer = 0;
            switch_char_anim('boat');
        }
    }

    if (character.z <= water_level && dynamic_elev_at(character.x, character.y) <= water_level) {
        game_state = State.PLOOP;
        playSfx('die');
        switch_char_anim('sink');
    }
}

function next_level() {
    console.log("next level");
    level_number ++;
    water_level = 0;
    load_level();
}

let gravity = 500;

let RAINDROP_EVERY = 0.015;
let RAINDROP_SPEED = 170;
let raindrop_timer = 0;
let raindrops = [];

function spawn_raindrop() {
    let raindrop = {
        x: Math.random() * level_w * tile_size * 1.2 + level_w * tile_size * 0.7,
        y: Math.random() * level_h * tile_size * 1.2,
        z: level_h * tile_size,
        frame: 0,
        exploded: false,
    }
    raindrops.push(raindrop);
}

function update_raindrop(r, delta) {
    if (!r.exploded) {
        r.z -= RAINDROP_SPEED * delta / 1000;
        r.x -= RAINDROP_SPEED * delta / 1000;
        if (r.z <= 0) {
            r.exploded = true;
            r.explode_timer = 0;
            r.frame = 1;
        }
    } else {
        r.explode_timer += delta;
        if (r.explode_timer > 100) {
            r.frame ++;
            r.explode_timer = 0;
        }

        if (r.frame > 2) {
            r.deleteme = true;
        }
    }
}

function update(delta) {
    let seconds = delta / 1000;

    if (level_number != 11) {
        raindrop_timer += seconds;
        while (raindrop_timer > RAINDROP_EVERY) {
            spawn_raindrop();
            raindrop_timer -= RAINDROP_EVERY;
        }
    }

    for (let r of raindrops) {
        update_raindrop(r, delta);
    }
    raindrops = raindrops.filter(r => !r.deleteme);

    if (transition.is_transitioning) {
        transition.timer += delta;
        if (transition.timer > transition.end_time) {
            finish_transition();
        }
    }

    character.frame_time += delta;
    while (character.frame_time > get_current_char_anim().frame_length) {
        character.frame_time = goodmod(character.frame_time, get_current_char_anim().frame_length);
        character.anim_frame_index ++;
        if (!get_current_char_anim().noloop) {
            character.anim_frame_index = goodmod(character.anim_frame_index, get_current_char_anim().frames.length);
        } else if (character.anim_frame_index >= get_current_char_anim().frames.length) {
            character.anim_frame_index = get_current_char_anim().frames.length - 1;
        }
    }

    if (game_state == State.STAND || game_state == State.MOVE && character.move_fraction >= 1) {
        let will_move_next = false;
        let tried_move = false;
        if (keys_down.left && !keys_down.right) {
            will_move_next = do_move(-1, 0);
            character.move_fraction = goodmod(character.move_fraction, 1);
            tried_move = true;
        } else if (keys_down.right && !keys_down.left) {
            will_move_next = do_move(1, 0);
            character.move_fraction = goodmod(character.move_fraction, 1);
            tried_move = true;
        } else if (keys_down.up && !keys_down.down) {
            will_move_next = do_move(0, -1);
            character.move_fraction = goodmod(character.move_fraction, 1);
            tried_move = true;
        } else if (keys_down.down && !keys_down.up) {
            will_move_next = do_move(0, 1);
            character.move_fraction = goodmod(character.move_fraction, 1);
            tried_move = true;
        }

        if (!will_move_next) {
            if (character.anim != 'boat') {
                character.move_fraction = 0;
                switch_char_anim('stand');
                game_state = State.STAND;
            }
        } else {
            save_undo_state();
        }
    }

    if (game_state == State.MOVE) {
        character.move_fraction += CHARACTER_WALK_SPEED / tile_size * seconds;
        if (character.move_fraction >= 1) {
            character.x = character.target_x;
            character.y = character.target_y;
            on_enter_tile();
        }
    }

    if (game_state == State.HOP) {
        character.zspeed -= gravity * seconds;
        character.z += character.zspeed * seconds;
        character.move_fraction += CHARACTER_WALK_SPEED / tile_size * seconds;
        if (character.move_fraction >= 1) {
            character.move_fraction = 1;
            character.x = character.target_x;
            character.y = character.target_y;
            if (character.z < dynamic_elev_at(character.x, character.y)) {
                game_state = State.STAND;
                character.move_fraction = 0;
                character.z = dynamic_elev_at(character.x, character.y);
                character.zspeed = 0;
                playSfx('land');
                on_enter_tile();
            }
        }
    }

    if (game_state == State.CLIMB) {
        character.z += CHARACTER_CLIMB_SPEED * seconds;
        if (character.z >= elev_at(character.x, character.y - 1) + 16) {
            character.y = character.y - 1;
            game_state = State.STAND;
            character.move_fraction = 0;
            character.z = elev_at(character.x, character.y);
            character.zspeed = 0;
            on_enter_tile();
        }
    }

    if (game_state == State.BOAT) {
        objs[0].move_fraction += BOAT_SPEED * seconds;
        end_timer += seconds;
        objs[0].target_x = objs[0].x + 1;
        objs[0].target_y = objs[0].y;
        while (objs[0].move_fraction > 1) {
            objs[0].move_fraction -= 1;
            objs[0].x ++;
            objs[0].target_x ++;
        }
        console.log(objs[0].y);
        character.x = objs[0].x;
        character.y = objs[0].y;
        character.target_x = objs[0].target_x;
        character.target_y = character.y;
        character.move_fraction = objs[0].move_fraction;
        objs[0].hide = true;
    }

    if (game_state != State.BOAT) {
        /* Update objects */
        for (let o of objs) {
            o.frame_time += delta;
            while (o.frame_time > o.frame_length) {
                o.frame_time = goodmod(o.frame_time, o.frame_length)
                o.anim_frame_index ++;
                o.anim_frame_index = goodmod(o.anim_frame_index, 4);
            }

            if (o.z > dynamic_elev_below(o.z, o.x, o.y) && !(floats[o.id] && o.z + objheights[o.id] <= water_level + 1)) {
                let could_splash = false;
                if (o.z + 1 >= water_level) {
                    could_splash = true;
                }

                o.z += o.zspeed * seconds;
                o.zspeed -= gravity * seconds;
                game_state = State.OBJFALL;

                if (could_splash && o.z < water_level) {
                    playSfx('splash');
                }

                if (o.z <= dynamic_elev_below(o.z, o.x, o.y)) {
                    o.stable = true;
                    o.z = dynamic_elev_below(o.z, o.x, o.y);
                    o.zspeed = 0;
                    playSfx('land');
                    game_state = State.STAND;
                }

                if (floats[o.id] && o.z + objheights[o.id] <= water_level + 1) {
                    /* Floating objects stop at water surface, not floor */
                    o.zspeed = 0;
                    o.z = water_level + 1 - objheights[o.id];
                    game_state = State.STAND;
                }
            } else {
                o.stable = true;
            }

            if (o.target_x !== undefined && o.target_x != o.x || o.target_y !== undefined && o.target_y != o.y) {
                o.move_fraction += CHARACTER_WALK_SPEED / tile_size * seconds;
                o.stable = false;
                if (o.move_fraction >= 1) {
                    o.x = o.target_x;
                    o.y = o.target_y;
                    o.move_fraction = 0;
                }
            }
        }
    }
}

function draw() {
    let ctx = draw_ctx;

    ctx.save();

    ctx.fillStyle = 'rgb(' + bg_color + ')';

    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fill();

    let offset_x = Math.round((CANVAS_WIDTH / draw_scale - level_w * tile_size) / 2);
    let offset_y = Math.round((CANVAS_HEIGHT / draw_scale - level_h * tile_size) / 2);

    ctx.save();
    ctx.translate(offset_x, offset_y);

    draw_level(ctx);

    if (transition.mid_long) {
        ctx.fillStyle = transition.color;
        ctx.fillRect(-1, -1, canvas_w, canvas_h);
    }

    ctx.restore();

    for (let r of raindrops) {
        draw_raindrop(ctx, r);
    }

    ctx.drawImage(level_images[level_number], 0, 0);

    if (end_timer > END_DELAY) {
        ctx.save();
        ctx.globalAlpha = (end_timer - END_DELAY) / END_FADE_TIME;
        ctx.drawImage(end_img, 0, 0);
        ctx.restore();
    }

    ctx.restore();

    global_ctx.fillStyle = 'rgb(0, 0, 0)';
    global_ctx.beginPath();
    global_ctx.rect(0, 0, canvas_w * draw_scale, canvas_h * draw_scale);
    global_ctx.fill();

    global_ctx.save();

    global_ctx.scale(draw_scale, draw_scale);

    global_ctx.drawImage(ctx.canvas, 0, 0);

    if (!can_go) {
        global_ctx.drawImage(clickstart_img, 0, 0);
    }

    if (transition.is_transitioning) {
        global_ctx.save();

        if (transition.type == TransitionType.DOTS) {
            mask_ctx.clearRect(0, 0, canvas_w, canvas_h);
            draw_transition_dot_mask(mask_ctx);

            // Redraw to reduce antialiasing effects
            for (let i = 0; i < 5; i++) {
                mask_ctx.drawImage(mask_ctx.canvas, 0, 0);
            }

            mask_ctx.globalCompositeOperation = 'source-in';
            mask_ctx.drawImage(copy_ctx.canvas, 0, 0);
            mask_ctx.globalCompositeOperation = 'source-over';

            global_ctx.drawImage(mask_ctx.canvas, 0, 0);
        } else if (transition.type == TransitionType.SLIDE_DOWN) {
            let offset = transition.timer / SLIDE_TRANSITION_LENGTH * canvas_h;

            global_ctx.drawImage(copy_ctx.canvas, 0, -offset);
            global_ctx.drawImage(ctx.canvas, 0, canvas_h - offset);
        } else if (transition.type == TransitionType.SLIDE_UP) {
            let offset = transition.timer / SLIDE_TRANSITION_LENGTH * canvas_h;

            global_ctx.drawImage(copy_ctx.canvas, 0, offset);
            global_ctx.drawImage(ctx.canvas, 0, - canvas_h + offset);
        } else if (transition.type == TransitionType.FADE || transition.type == TransitionType.FAST_FADE) {
            let alpha = 0;
            if (transition.type == TransitionType.FADE) {
                alpha = 1 - transition.timer / FADE_TRANSITION_LENGTH;
            } else if (transition.type == TransitionType.FAST_FADE) {
                alpha = 1 - transition.timer / FAST_FADE_TRANSITION_LENGTH;
            }

            mask_ctx.clearRect(0, 0, canvas_w, canvas_h);
            mask_ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            mask_ctx.fillRect(0, 0, canvas_w, canvas_h);
            mask_ctx.globalCompositeOperation = 'source-in';
            mask_ctx.drawImage(copy_ctx.canvas, 0, 0);
            mask_ctx.globalCompositeOperation = 'source-over';

            global_ctx.drawImage(mask_ctx.canvas, 0, 0);
        }

        global_ctx.restore();
    }

    global_ctx.restore();
}

let dry_outline_color = 'rgb(50, 50, 50)';
let wet_outline_color = 'rgb(16, 51, 129)';

function draw_level(ctx) {
    for (let y = 0; y < level_h + 1; y++) {
        for (let x = 0; x < level_w; x++) {
            let elevation = Math.floor(elev_at(x, y) / tile_height);
            let sprite;

            if ((x + y) % 2 == 0) {
                if (elev_at(x, y) == 0) {
                    sprite = 2;
                } else {
                    sprite = 0;
                }
            } else {
                if (elev_at(x, y) == 0) {
                    sprite = 3;
                } else {
                    sprite = 1;
                }
            }

            /* Draw tile surface */
            let variant = 0;
            if (elevation <= Math.floor(water_level / tile_height)) {
                variant = 1;
            }

            ctx.drawImage(tiles,
                sprite * tile_size, variant * tile_size, tile_size, tile_size,
                x * tile_size, y * tile_size - tile_height * elevation, tile_size, tile_size);

            if (numeral_locations.hasOwnProperty(x + "," + y)) {
                ctx.drawImage(numerals_img,
                    (elevation - 1) * tile_size, variant * tile_size, tile_size, tile_size,
                    x * tile_size, y * tile_size - tile_height * elevation, tile_size, tile_size);
            }

            /* Draw pillar */
            let ladder_below = false;
            let objs = objs_at(x, y + 1);
            if (objs_at(x, y + 1).filter(o => o.id == ID.ladder).length > 0) {
                ladder_below = true;
            }
            for (let i = 0; i < elevation; i++) {
                // 'side part x', 'side part y'
                let spx = x * tile_size;
                let spy = (y + 1) * tile_size - (elevation - i) * tile_height;
                if (elevation - i > Math.floor(water_level / tile_height) + 1) {
                    ctx.drawImage(height_tiles,
                        0, 0, tile_size, tile_height,
                        spx, spy, tile_size, tile_height);

                    if (ladder_below) {
                        ctx.drawImage(objs_img,
                            ID.ladder * tile_size, 2 * tile_size - tile_height, tile_size, tile_height,
                            spx, spy, tile_size, tile_height);
                    }
                } else if (elevation - i < Math.floor(water_level / tile_height) + 1) {
                    ctx.drawImage(height_tiles,
                        0, tile_height, tile_size, tile_height,
                        spx, spy, tile_size, tile_height);

                    if (ladder_below) {
                        ctx.drawImage(objs_img,
                            ID.ladder * tile_size, 4 * tile_size - tile_height, tile_size, tile_height,
                            spx, spy, tile_size, tile_height);
                    }
                } else if (elevation - i == Math.floor(water_level / tile_height) + 1) {
                    let amount_submerged = water_level % tile_height + 1;
                    ctx.drawImage(height_tiles,
                        0, 0, tile_size, tile_height - amount_submerged,
                        spx, spy, tile_size, tile_height - amount_submerged);
                    ctx.drawImage(height_tiles,
                        0, 2 * tile_height - amount_submerged, tile_size, amount_submerged,
                        spx, spy + tile_height - amount_submerged, tile_size, amount_submerged);

                    if (ladder_below) {
                        ctx.drawImage(objs_img,
                            ID.ladder * tile_size, 2 * tile_size - tile_height, tile_size, tile_height - amount_submerged,
                            spx, spy, tile_size, tile_height - amount_submerged);
                        ctx.drawImage(objs_img,
                            ID.ladder * tile_size, 4 * tile_size - amount_submerged, tile_size, amount_submerged,
                            spx, spy + tile_height - amount_submerged, tile_size, amount_submerged);
                    }
                }
            }

            let is_underwater = (elevation * tile_height <= water_level);

            /* Draw tile outline */
            if (is_underwater) {
                ctx.strokeStyle = wet_outline_color;
            } else {
                ctx.strokeStyle = dry_outline_color;
            }
            ctx.beginPath();
            if (x != 0 && elev_at(x - 1, y) != elev_at(x, y)) {
                ctx.moveTo(x * tile_size + 0.5, y * tile_size - elevation * tile_height);
                ctx.lineTo(x * tile_size + 0.5, (y + 1) * tile_size - elevation * tile_height);
            }
            if (x != level_w && elev_at(x + 1, y) != elev_at(x, y)) {
                ctx.moveTo((x + 1) * tile_size - 0.5, y * tile_size - elevation * tile_height);
                ctx.lineTo((x + 1) * tile_size - 0.5, (y + 1) * tile_size - elevation * tile_height);
            }
            if (y != 0 && elev_at(x, y - 1) != elev_at(x, y)) {
                ctx.moveTo(x * tile_size, y * tile_size - elevation * tile_height + 0.5);
                ctx.lineTo((x + 1) * tile_size, y * tile_size - elevation * tile_height + 0.5);
            }
            if (y != level_h && elev_at(x, y + 1) != elev_at(x, y)) {
                ctx.moveTo(x * tile_size, (y + 1) * tile_size - elevation * tile_height - 0.5);
                ctx.lineTo((x + 1) * tile_size, (y + 1) * tile_size - elevation * tile_height - 0.5);
            }
            ctx.stroke();

            /* Draw pillar sides */
            draw_pillar_side(ctx, x, y, x - 1, y, x * tile_size + 0.5);
            draw_pillar_side(ctx, x, y, x + 1, y, (x + 1) * tile_size - 0.5);

            /* Draw water outline */
            let threshold = water_level / tile_height;
            let left_elevation = Math.floor(elev_at(x - 1, y) / tile_height);
            let right_elevation = Math.floor(elev_at(x + 1, y) / tile_height);
            let up_elevation = Math.floor(elev_at(x, y - 1) / tile_height);
            let down_elevation = Math.floor(elev_at(x, y + 1) / tile_height);

            ctx.strokeStyle = 'rgb(166, 246, 255)';
            if (elevation <= threshold && up_elevation > threshold) {
                ctx.beginPath();
                ctx.moveTo(x * tile_size, y * tile_size - water_level - 0.5);
                ctx.lineTo((x + 1) * tile_size, y * tile_size - water_level - 0.5);
                ctx.stroke();
            }
            if (elevation <= threshold && down_elevation > threshold) {
                ctx.beginPath();
                ctx.moveTo(x * tile_size, (y + 1) * tile_size - water_level - 1.5);
                ctx.lineTo((x + 1) * tile_size, (y + 1) * tile_size - water_level - 1.5);
                ctx.stroke();
            }
            if (elevation <= threshold && left_elevation > threshold) {
                ctx.beginPath();
                ctx.moveTo(x * tile_size + 0.5, y * tile_size - water_level - 1);
                ctx.lineTo(x * tile_size + 0.5, (y + 1) * tile_size - water_level - 1);
                ctx.stroke();
            }
            if (elevation <= threshold && right_elevation > threshold) {
                ctx.beginPath();
                ctx.moveTo((x + 1) * tile_size - 0.5, y * tile_size - water_level - 1);
                ctx.lineTo((x + 1) * tile_size - 0.5, (y + 1) * tile_size - water_level - 1);
                ctx.stroke();
            }

        }

        let row_objs = objs.filter(o => o.y == y || o.target_y == y).sort((a, b) => a.z - b.z);
        for (let o of row_objs) {
            if (o.hide) continue;
            draw_obj_shadow(ctx, o);
        }
        for (let o of row_objs) {
            draw_obj(ctx, o);
        }

        if (y == Math.max(character.y, character.target_y)) {
            draw_character(ctx);
        }
    }
}

function draw_pillar_side(ctx, x1, y1, x2, y2, xcoord) {
    let elevation = Math.floor(elev_at(x1, y1) / tile_height);
    let other_elevation = Math.floor(elev_at(x2, y2) / tile_height);
    if (elevation > other_elevation) {
        let threshold = Math.floor(water_level / tile_height);
        if (other_elevation > threshold || elevation < threshold) {
            /* Both are on the same side of the water, so draw one continuous line */
            if (other_elevation > threshold) {
                ctx.strokeStyle = dry_outline_color;
            } else {
                ctx.strokeStyle = wet_outline_color;
            }
            ctx.beginPath();
            ctx.moveTo(xcoord, (y1 + 1) * tile_size - elevation * tile_height);
            ctx.lineTo(xcoord, (y1 + 1) * tile_size - other_elevation * tile_height);
            ctx.stroke();
        } else {
            /* We are above the water but the tile is below. Draw a grey line down to the water
             * and a blue line below. */
            ctx.strokeStyle = dry_outline_color;
            ctx.beginPath();
            ctx.moveTo(xcoord, (y1 + 1) * tile_size - elevation * tile_height);
            ctx.lineTo(xcoord, (y1 + 1) * tile_size - water_level - 2);
            ctx.stroke();

            ctx.strokeStyle = wet_outline_color;
            ctx.beginPath();
            ctx.moveTo(xcoord, (y1 + 1) * tile_size - water_level - 2);
            ctx.lineTo(xcoord, (y1 + 1) * tile_size - other_elevation * tile_height);
            ctx.stroke();
        }
    }
}


function draw_character(ctx) {
    let char_frame = get_current_char_anim().frames[character.anim_frame_index];

    {
        let mf = character.move_fraction;
        let x = character.x;
        let y = character.y;
        let tx = character.target_x;
        let ty = character.target_y;

        let ox = 0;
        if (character.anim == 'boat') {
            ox = 1;
        } else if (character.direction == 'left') {
            ox = 2;
        } else if (character.direction == 'right') {
            ox = -2;
        }

        let oy = 0;
        if (character.anim == 'boat') {
            oy = 2;
        }

        ctx.drawImage(character_img,
            0, char_frame * char_anim_size.h, char_anim_size.w, char_anim_size.h,
            (x * (1 - mf) + tx * mf) * tile_size - char_anim_size.offset_x + ox,
            (y * (1 - mf) + ty * mf) * tile_size - char_anim_size.offset_y - character.z + oy,
            char_anim_size.w, char_anim_size.h);
    }
}

function draw_obj_shadow(ctx, obj) {
    /* Draw shadow */
    if (obj.move_fraction) return;

    let srcy = 6 * tile_size;
    if (elev_at(obj.x, obj.y) < water_level) {
        srcy = 7 * tile_size;
    }

    ctx.drawImage(objs_img,
        obj.id * tile_size, srcy, tile_size, tile_size,
        obj.x * tile_size, obj.y * tile_size - elev_at(obj.x, obj.y), tile_size, tile_size);
}

function draw_obj(ctx, obj) {
    if (obj.id != ID.finish && obj.id != ID.ladder) {
        let objheight = 0;
        if (objheights[obj.id]) {
            objheight = objheights[obj.id];
        }

        let imgheight = tile_size;
        imgheight = objheight + tile_size;

        let amount_above_water = Math.max(-1, Math.min(objheight + 1, obj.z + objheight - water_level)) - 1;
        let amount_below_water = objheight - amount_above_water;

        if (obj.move_fraction) {
            let mf = obj.move_fraction;

            ctx.drawImage(objs_img,
                obj.id * tile_size, 2 * tile_size - imgheight, tile_size, imgheight - amount_below_water,
                /* divide and round for pixel-y movement */
                Math.round((obj.x * (1 - mf) + obj.target_x * mf) * tile_size),
                Math.round((obj.y * (1 - mf) + obj.target_y * mf) * tile_size) - obj.z - (imgheight - tile_size),
                tile_size, imgheight - amount_below_water);

            ctx.drawImage(objs_img,
                obj.id * tile_size, 4 * tile_size - imgheight + amount_above_water + tile_size, tile_size, amount_below_water,
                /* divide and round for pixel-y movement */
                Math.round((obj.x * (1 - mf) + obj.target_x * mf) * tile_size),
                Math.round((obj.y * (1 - mf) + obj.target_y * mf) * tile_size) - obj.z
                    - (imgheight - tile_size) + amount_above_water + tile_size,
                tile_size, amount_below_water);

            if (amount_below_water > 0 && amount_below_water <= objheight) {
                ctx.drawImage(objs_img,
                    obj.id * tile_size, 4 * tile_size, tile_size, tile_size,
                    Math.round((obj.x * (1 - mf) + obj.target_x * mf) * tile_size), obj.y * tile_size - obj.z - amount_below_water,
                    tile_size, tile_size);
            }
        } else {
            if (amount_below_water <= objheight) {
                if (amount_below_water > 0 && amount_below_water <= objheight) {
                    ctx.drawImage(objs_img,
                        obj.id * tile_size, 5 * tile_size, tile_size, tile_size,
                        obj.x * tile_size, obj.y * tile_size - obj.z - amount_below_water,
                        tile_size, tile_size);
                }

                if (!obj.hide) {
                    ctx.drawImage(objs_img,
                        obj.id * tile_size, 2 * tile_size - imgheight, tile_size, imgheight - amount_below_water,
                        obj.x * tile_size,
                        obj.y * tile_size - obj.z - (imgheight - tile_size),
                        tile_size, imgheight - amount_below_water);

                    ctx.drawImage(objs_img,
                        obj.id * tile_size, 4 * tile_size - amount_below_water, tile_size, amount_below_water,
                        obj.x * tile_size,
                        obj.y * tile_size - obj.z - (imgheight - tile_size) + amount_above_water + tile_size,
                        tile_size, amount_below_water);
                }

                if (amount_below_water > 0 && amount_below_water <= objheight) {
                    ctx.drawImage(objs_img,
                        obj.id * tile_size, 4 * tile_size, tile_size, tile_size,
                        obj.x * tile_size, obj.y * tile_size - obj.z - amount_below_water,
                        tile_size, tile_size);
                }
            } else {
                ctx.drawImage(objs_img,
                    obj.id * tile_size, 4 * tile_size - imgheight, tile_size, imgheight,
                    obj.x * tile_size,
                    obj.y * tile_size - obj.z - (imgheight - tile_size),
                    tile_size, imgheight);
            }
        }
    }
}

function draw_raindrop(ctx, r) {
    ctx.drawImage(raindrop_img,
        0, r.frame * 10, 10, 10,
        r.x, r.y - r.z, 10, 10);
}

function draw_transition_dot_mask(ctx) {
    ctx.fillStyle = '#0000ff';
    let cell_width = canvas_w / transition.w;
    let cell_height = canvas_h / transition.h;
    let max_radius = 0.75 * Math.max(cell_width, cell_height);

    for (let x = -1; x < transition.w + 1; x++) {
        for (let y = -1; y < transition.h + 1; y++) {
            let radius;

            let circle_start_time = (x + y) / (transition.w + transition.h) * (DOT_TRANSITION_LENGTH - TRANSITION_DOT_LENGTH);
            if (transition.timer - circle_start_time < 0) {
                if (transition.invert_shape) {
                    radius = 0;
                } else {
                    radius = max_radius;
                }
            } else if (transition.timer - circle_start_time < TRANSITION_DOT_LENGTH) {
                if (transition.invert_shape) {
                    radius = (transition.timer - circle_start_time) / TRANSITION_DOT_LENGTH * max_radius;
                } else {
                    radius = (1 - (transition.timer - circle_start_time) / TRANSITION_DOT_LENGTH) * max_radius;
                }
            } else {
                if (transition.invert_shape) {
                    radius = max_radius;
                } else {
                    radius = 0;
                }
            }

            let draw_x = x;
            let draw_y = y;
            if (transition.dir_invert_v) draw_x = transition.w - 1 - x;
            if (transition.dir_invert_h) draw_y = transition.h - 1 - y;

            if (radius >= max_radius * 0.8) {
                if (!transition.invert_shape) {
                    ctx.fillRect(draw_x * cell_width, draw_y * cell_width, cell_width + 1, cell_width + 1);
                }
            } else if (radius > 0) {
                ctx.save();
                ctx.beginPath();
                if (transition.invert_shape) {
                    ctx.rect(draw_x * cell_width, draw_y * cell_width, cell_width + 3, cell_width + 3);
                }
                ctx.moveTo(draw_x * cell_width + cell_width / 2, draw_y * cell_width + cell_width / 2);
                ctx.arc(draw_x * cell_width + cell_width / 2,
                         draw_y * cell_width + cell_width / 2,
                         radius, 0, 2 * Math.PI, transition.invert_shape);
                ctx.clip();
                ctx.fillRect(draw_x * cell_width, draw_y * cell_width, cell_width, cell_width);
                ctx.restore();
            } else {
                if (transition.invert_shape) {
                    ctx.fillRect(draw_x * cell_width, draw_y * cell_width, cell_width + 3, cell_width + 3);
                }
            }
        }
    }
}
