// Shared numbers of the game world. Units are pixels and seconds; y grows
// upwards, as in the original Bevy version, so values port unchanged.

/** Size of the visible game world. Phones scale it to fit. */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 800;

/**
 * Longest frame time the rules simulate in one step. A longer stall is
 * simulated as if it were this long, so nothing tunnels through thin obstacles.
 */
export const MAX_FRAME_DELTA = 1 / 30;

export const GRAVITY = 1800;
export const JUMP_VELOCITY = 800;

/** The dog's collision box (body and feet), smaller than its picture. */
export const DOG_HALF_SIZE = { x: 30, y: 34 } as const;

/** Where the dog normally runs, measured from the left edge of the view. */
export const HOME_FROM_LEFT_EDGE = 320;
/**
 * How strongly the dog runs back towards its home position after being held
 * back, and the most extra speed it uses for that.
 */
export const CATCH_UP_GAIN = 3;
export const MAX_CATCH_UP_SPEED = 160;

/** A jump still works for this long after running off an edge. */
export const COYOTE_TIME = 0.1;
/** A jump pressed this long before landing still fires on landing. */
export const JUMP_BUFFER_TIME = 0.12;

export const STARTING_HEARTS = 3;
/** After a respawn the dog cannot lose a heart for this long. */
export const RESPAWN_GRACE = 2;
export const SNOWBALL_RADIUS = 32;
/** Snowballs roll towards the dog at this speed. */
export const SNOWBALL_SPEED = 130;
export const SNOWBALL_GRAVITY = 1200;
/** Snowball hits use a slightly smaller box, so a near miss is a miss. */
export const SNOWBALL_HIT_SHRINK = 8;

export const GROUND_TOP = -300;
export const GROUND_BOTTOM = -400;
/** Falling below this height means the dog fell into a gap. */
export const FALL_LIMIT = -520;

export const HURDLE_WIDTH = 16;
export const HURDLE_HEIGHT = 45;
export const COOKIE_RADIUS = 18;

/** A snowman on the course: the dog must jump clear of it, and knocking it costs a heart. */
export const SNOWMAN_WIDTH = 40;
export const SNOWMAN_HEIGHT = 74;
/** Snowman hits use a narrower box, so brushing its round sides is a miss. */
export const SNOWMAN_HIT_SHRINK = 8;

/** A second tap in the air jumps again from there, once per jump, this fast. */
export const AIR_JUMP_VELOCITY = 650;
/**
 * The second jump only works until the dog falls this fast. A tap later in
 * the fall is kept for the landing instead, as before.
 */
export const AIR_JUMP_LATEST_FALL = 450;

/** Fixed course speed of door 1, the original level's normal pace. */
export const DOOR_ONE_SPEED = 200;
