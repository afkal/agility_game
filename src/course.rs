//! The Christmas agility course: its layout as data, and building it into
//! entities the rules and visuals work with.

use bevy::prelude::*;

use crate::hazards::reset_hazards;
use crate::physics::{Aabb, Ramp, Solid};
use crate::player::{CourseSolids, Dog, HOME_FROM_LEFT_EDGE};
use crate::rules::{GameState, ScrollPosition, ScrollSpeed, WINDOW_WIDTH};

pub const GROUND_TOP: f32 = -300.0;
pub const GROUND_BOTTOM: f32 = -400.0;
/// Falling below this height means the dog fell into a gap.
pub const FALL_LIMIT: f32 = -520.0;

pub const HURDLE_WIDTH: f32 = 16.0;
pub const HURDLE_HEIGHT: f32 = 45.0;
pub const COOKIE_RADIUS: f32 = 18.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Table {
    pub x0: f32,
    pub x1: f32,
    pub top: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AFrame {
    pub x0: f32,
    pub half_width: f32,
    pub height: f32,
}

impl AFrame {
    pub fn apex(&self) -> Vec2 {
        Vec2::new(self.x0 + self.half_width, GROUND_TOP + self.height)
    }

    pub fn ramps(&self) -> [Ramp; 2] {
        let apex = self.apex();
        [
            Ramp {
                start: Vec2::new(self.x0, GROUND_TOP),
                end: apex,
            },
            Ramp {
                start: apex,
                end: Vec2::new(self.x0 + 2.0 * self.half_width, GROUND_TOP),
            },
        ]
    }
}

/// Everything that makes up one course.
#[derive(Resource, Clone, Debug, Default, PartialEq)]
pub struct CourseLayout {
    /// Snowy ground runs as `(from x, to x)`. Spaces between runs are gaps.
    pub ground: Vec<(f32, f32)>,
    /// Left x of each candy-cane hurdle standing on the ground.
    pub hurdles: Vec<f32>,
    pub tables: Vec<Table>,
    pub aframes: Vec<AFrame>,
    pub cookies: Vec<Vec2>,
    /// Checkpoint x positions, each on solid ground.
    pub checkpoints: Vec<f32>,
    /// Where each rolling snowball appears, as an x on the ground.
    pub snowballs: Vec<f32>,
    pub start_x: f32,
    pub finish_x: f32,
}

impl CourseLayout {
    pub fn solids(&self) -> Vec<Solid> {
        let mut solids = Vec::new();
        for &(x0, x1) in &self.ground {
            solids.push(Solid::Box(Aabb {
                min: Vec2::new(x0, GROUND_BOTTOM),
                max: Vec2::new(x1, GROUND_TOP),
            }));
        }
        for &x in &self.hurdles {
            solids.push(Solid::Box(hurdle_box(x)));
        }
        for table in &self.tables {
            solids.push(Solid::Box(table_box(table)));
        }
        for aframe in &self.aframes {
            for ramp in aframe.ramps() {
                solids.push(Solid::Ramp(ramp));
            }
        }
        solids
    }

    /// Gaps between ground runs, as `(from x, to x)`.
    pub fn gaps(&self) -> Vec<(f32, f32)> {
        self.ground
            .windows(2)
            .filter(|w| w[1].0 > w[0].1)
            .map(|w| (w[0].1, w[1].0))
            .collect()
    }

    /// Height of the highest walkable surface under `x`, if any.
    pub fn surface_at(&self, x: f32) -> Option<f32> {
        let mut best: Option<f32> = None;
        let mut consider = |h: f32| best = Some(best.map_or(h, |b: f32| b.max(h)));
        if self.ground.iter().any(|&(a, b)| x >= a && x <= b) {
            consider(GROUND_TOP);
        }
        for table in &self.tables {
            if x >= table.x0 && x <= table.x1 {
                consider(table.top);
            }
        }
        for aframe in &self.aframes {
            for ramp in aframe.ramps() {
                if let Some(h) = ramp.height_at(x) {
                    consider(h);
                }
            }
        }
        best
    }

    /// The Christmas course: an easy start, then hurdles, tables, gaps, the
    /// A-frame and snowballs, mixed more and more towards the finish.
    pub fn christmas() -> Self {
        let mut b = Builder::new();
        b.flat(900, true);
        // Warm-up: single hurdles and a low table.
        b.hurdle();
        b.flat(500, true);
        b.hurdle();
        b.flat(400, false);
        b.table(350, 70.0);
        b.flat(500, true);
        b.checkpoint();
        // Gaps.
        b.gap(100.0);
        b.flat(500, true);
        b.hurdle();
        b.flat(400, false);
        b.gap(120.0);
        b.flat(600, true);
        b.checkpoint();
        // Table stairs.
        b.stairs(70.0, 140.0);
        b.flat(500, true);
        b.hurdle();
        b.flat(300, false);
        b.hurdle();
        b.flat(500, true);
        b.checkpoint();
        // First snowball and the A-frame.
        b.snowball();
        b.flat(400, false);
        b.aframe();
        b.flat(500, true);
        b.checkpoint();
        // Mixing it up.
        b.gap(110.0);
        b.flat(400, true);
        b.table(400, 90.0);
        b.flat(300, false);
        b.hurdle();
        b.flat(500, true);
        b.snowball();
        b.checkpoint();
        b.stairs(80.0, 160.0);
        b.flat(300, false);
        b.gap(130.0);
        b.flat(500, true);
        b.hurdle();
        b.flat(300, false);
        b.hurdle();
        b.flat(400, true);
        b.checkpoint();
        b.aframe();
        b.flat(300, false);
        b.gap(120.0);
        b.flat(400, true);
        b.snowball();
        b.hurdle();
        b.flat(500, true);
        b.checkpoint();
        // Final stretch.
        b.table(300, 100.0);
        b.flat(200, false);
        b.gap(130.0);
        b.flat(400, true);
        b.stairs(90.0, 170.0);
        b.flat(300, false);
        b.hurdle();
        b.flat(300, false);
        b.hurdle();
        b.flat(400, true);
        b.snowball();
        b.checkpoint();
        b.aframe();
        b.flat(400, true);
        b.gap(140.0);
        b.flat(600, true);
        b.finish();
        b.finish_layout()
    }

    /// A plain flat course of the given length, used by tests.
    #[cfg(test)]
    pub fn flat(length: f32) -> Self {
        Self {
            ground: vec![(-1_000.0, length)],
            start_x: 0.0,
            finish_x: length - 200.0,
            ..default()
        }
    }
}

pub fn hurdle_box(x: f32) -> Aabb {
    Aabb {
        min: Vec2::new(x, GROUND_TOP),
        max: Vec2::new(x + HURDLE_WIDTH, GROUND_TOP + HURDLE_HEIGHT),
    }
}

pub fn table_box(table: &Table) -> Aabb {
    Aabb {
        min: Vec2::new(table.x0, GROUND_TOP),
        max: Vec2::new(table.x1, table.top),
    }
}

/// Lays the course out left to right from a cursor.
struct Builder {
    x: f32,
    layout: CourseLayout,
}

/// Cookies float this high above the surface they belong to, within reach of a
/// standing or lightly jumping dog.
const COOKIE_LIFT: f32 = 60.0;

impl Builder {
    fn new() -> Self {
        Self {
            x: -600.0,
            layout: CourseLayout {
                start_x: 0.0,
                ..default()
            },
        }
    }

    fn ground(&mut self, length: f32) {
        let end = self.x + length;
        match self.layout.ground.last_mut() {
            Some(last) if (last.1 - self.x).abs() < 0.01 => last.1 = end,
            _ => self.layout.ground.push((self.x, end)),
        }
        self.x = end;
    }

    fn cookie(&mut self, x: f32, y: f32) {
        self.layout.cookies.push(Vec2::new(x, y));
    }

    /// Flat snowy ground, optionally with a row of cookies along it.
    fn flat(&mut self, length: i32, cookies: bool) {
        let start = self.x;
        let length = length as f32;
        if cookies {
            let count = (length / 180.0).floor() as i32;
            for i in 0..count {
                let x = start + 150.0 + i as f32 * 180.0;
                if x < start + length - 100.0 {
                    self.cookie(x, GROUND_TOP + COOKIE_LIFT);
                }
            }
        }
        self.ground(length);
    }

    /// A hurdle with an arc of cookies over it that a clean jump collects.
    fn hurdle(&mut self) {
        let x = self.x + 200.0;
        self.layout.hurdles.push(x);
        let mid = x + HURDLE_WIDTH / 2.0;
        self.cookie(mid - 60.0, GROUND_TOP + 130.0);
        self.cookie(mid, GROUND_TOP + 170.0);
        self.cookie(mid + 60.0, GROUND_TOP + 130.0);
        self.ground(400.0);
    }

    /// A single agility table of the given length and height.
    fn table(&mut self, length: i32, height: f32) {
        let x0 = self.x + 150.0;
        let x1 = x0 + length as f32;
        let top = GROUND_TOP + height;
        self.layout.tables.push(Table { x0, x1, top });
        let mut x = x0 + 80.0;
        while x < x1 - 60.0 {
            self.cookie(x, top + COOKIE_LIFT);
            x += 120.0;
        }
        self.ground(x1 - self.x + 250.0);
    }

    /// Two tables in a row, the second one higher: the dog climbs up.
    fn stairs(&mut self, low: f32, high: f32) {
        let x0 = self.x + 150.0;
        let mid = x0 + 260.0;
        let x1 = mid + 320.0;
        self.layout.tables.push(Table {
            x0,
            x1: mid,
            top: GROUND_TOP + low,
        });
        self.layout.tables.push(Table {
            x0: mid,
            x1,
            top: GROUND_TOP + high,
        });
        self.cookie(x0 + 130.0, GROUND_TOP + low + COOKIE_LIFT);
        self.cookie(mid + 100.0, GROUND_TOP + high + COOKIE_LIFT);
        self.cookie(mid + 220.0, GROUND_TOP + high + COOKIE_LIFT);
        self.ground(x1 - self.x + 300.0);
    }

    /// A gap with a cookie over the middle at jump height.
    fn gap(&mut self, width: f32) {
        self.cookie(self.x + width / 2.0, GROUND_TOP + 120.0);
        self.x += width;
    }

    /// The A-frame, with a cookie waiting at the top.
    fn aframe(&mut self) {
        let aframe = AFrame {
            x0: self.x + 150.0,
            half_width: 300.0,
            height: 150.0,
        };
        let apex = aframe.apex();
        self.layout.aframes.push(aframe);
        self.cookie(apex.x, apex.y + COOKIE_LIFT);
        self.cookie(aframe.x0 + 150.0, GROUND_TOP + 75.0 + COOKIE_LIFT);
        self.cookie(apex.x + 150.0, GROUND_TOP + 75.0 + COOKIE_LIFT);
        self.ground(2.0 * aframe.half_width + 400.0);
    }

    /// A long clear run where a snowball comes rolling towards the dog.
    fn snowball(&mut self) {
        self.layout.snowballs.push(self.x + 900.0);
        self.ground(1_100.0);
    }

    fn checkpoint(&mut self) {
        self.layout.checkpoints.push(self.x + 150.0);
        self.ground(300.0);
    }

    fn finish(&mut self) {
        self.layout.finish_x = self.x + 300.0;
        // Plenty of ground after the line so the view never runs off the end.
        self.ground(300.0 + WINDOW_WIDTH * 1.5);
    }

    fn finish_layout(self) -> CourseLayout {
        self.layout
    }
}

/// Marks every entity that belongs to the current run, so a rebuild can clear
/// them all at once.
#[derive(Component)]
pub struct CourseEntity;

/// A piece of course geometry, for the visuals to draw.
#[derive(Component, Clone, Copy, Debug)]
pub enum CoursePart {
    Ground(Aabb),
    Hurdle(Aabb),
    Table(Aabb),
    AFrame(AFrame),
}

#[derive(Component, Clone, Copy, Debug)]
pub struct Cookie {
    pub radius: f32,
}

#[derive(Component, Clone, Copy, Debug)]
pub struct CheckpointMarker {
    pub x: f32,
}

#[derive(Component, Clone, Copy, Debug)]
pub struct SnowballSpawn {
    pub x: f32,
}

#[derive(Component, Clone, Copy, Debug)]
pub struct FinishLine {
    pub x: f32,
}

/// Set to rebuild the course from scratch on the next frame.
#[derive(Resource, Debug)]
pub struct RestartRequested(pub bool);

impl Default for RestartRequested {
    fn default() -> Self {
        Self(true)
    }
}

pub fn rebuild_course(
    mut commands: Commands,
    mut restart: ResMut<RestartRequested>,
    layout: Res<CourseLayout>,
    existing: Query<Entity, With<CourseEntity>>,
    mut next_state: ResMut<NextState<GameState>>,
) {
    if !restart.0 {
        return;
    }
    restart.0 = false;
    for entity in &existing {
        commands.entity(entity).despawn();
    }
    spawn_course(&mut commands, &layout);
    reset_hazards(&mut commands);
    commands.insert_resource(ScrollSpeed::default());
    commands.insert_resource(ScrollPosition(
        layout.start_x - HOME_FROM_LEFT_EDGE + WINDOW_WIDTH / 2.0,
    ));
    next_state.set(GameState::Playing);
}

fn spawn_course(commands: &mut Commands, layout: &CourseLayout) {
    commands.insert_resource(CourseSolids(layout.solids()));

    for &(x0, x1) in &layout.ground {
        spawn_part(
            commands,
            CoursePart::Ground(Aabb {
                min: Vec2::new(x0, GROUND_BOTTOM),
                max: Vec2::new(x1, GROUND_TOP),
            }),
        );
    }
    for &x in &layout.hurdles {
        spawn_part(commands, CoursePart::Hurdle(hurdle_box(x)));
    }
    for table in &layout.tables {
        spawn_part(commands, CoursePart::Table(table_box(table)));
    }
    for aframe in &layout.aframes {
        spawn_part(commands, CoursePart::AFrame(*aframe));
    }
    for &pos in &layout.cookies {
        commands.spawn((
            CourseEntity,
            Cookie {
                radius: COOKIE_RADIUS,
            },
            Transform::from_translation(pos.extend(5.0)),
        ));
    }
    for &x in &layout.checkpoints {
        commands.spawn((
            CourseEntity,
            CheckpointMarker { x },
            Transform::from_xyz(x, GROUND_TOP, 2.0),
        ));
    }
    for &x in &layout.snowballs {
        commands.spawn((CourseEntity, SnowballSpawn { x }));
    }
    commands.spawn((
        CourseEntity,
        FinishLine { x: layout.finish_x },
        Transform::from_xyz(layout.finish_x, GROUND_TOP, 2.0),
    ));

    let start_surface = layout.surface_at(layout.start_x).unwrap_or(GROUND_TOP);
    let feet = Vec2::new(layout.start_x, start_surface);
    commands.spawn((
        CourseEntity,
        Dog::standing_at(feet),
        Transform::from_translation(feet.extend(10.0)),
    ));
}

fn spawn_part(commands: &mut Commands, part: CoursePart) {
    commands.spawn((CourseEntity, part, Transform::default()));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::player::{DOG_HALF_SIZE, GRAVITY, JUMP_VELOCITY};
    use crate::rules::{MIN_SCROLL_SPEED, NORMAL_SCROLL_SPEED};
    use crate::rules::test_support::*;

    /// Extra room kept on every jump so the course is comfortable, not exact.
    const MARGIN: f32 = 20.0;

    fn airtime() -> f32 {
        2.0 * JUMP_VELOCITY / GRAVITY
    }

    fn jump_height() -> f32 {
        JUMP_VELOCITY * JUMP_VELOCITY / (2.0 * GRAVITY)
    }

    /// How long the dog's feet stay above `height` during a jump from the ground.
    fn time_above(height: f32) -> f32 {
        let disc = JUMP_VELOCITY * JUMP_VELOCITY - 2.0 * GRAVITY * height;
        2.0 * disc.max(0.0).sqrt() / GRAVITY
    }

    fn course() -> CourseLayout {
        CourseLayout::christmas()
    }

    #[test]
    fn every_gap_can_be_fallen_into_and_jumped_at_slowest_pace() {
        let dog_width = 2.0 * DOG_HALF_SIZE.x;
        let reach = MIN_SCROLL_SPEED * airtime();
        let gaps = course().gaps();
        assert!(!gaps.is_empty());
        for (a, b) in gaps {
            let width = b - a;
            assert!(width > dog_width, "gap at {a} is too narrow to fall into: {width}");
            assert!(
                width <= reach + dog_width - MARGIN,
                "gap at {a} is too wide to jump at the slowest pace: {width}"
            );
        }
    }

    #[test]
    fn every_hurdle_can_be_cleared_at_slowest_pace() {
        let needed = HURDLE_WIDTH + 2.0 * DOG_HALF_SIZE.x + MARGIN;
        let cleared = MIN_SCROLL_SPEED * time_above(HURDLE_HEIGHT);
        assert!(cleared >= needed, "clears {cleared} px, needs {needed}");
    }

    #[test]
    fn every_step_up_is_lower_than_a_jump() {
        let layout = course();
        let mut steps = Vec::new();
        for table in &layout.tables {
            // The surface just before the table is what the dog jumps from.
            let before = layout.surface_at(table.x0 - 1.0).unwrap_or(GROUND_TOP);
            steps.push(table.top - before);
        }
        for step in steps {
            assert!(step <= jump_height() - MARGIN * 2.0, "step of {step} is too high");
        }
    }

    #[test]
    fn every_checkpoint_sits_on_solid_ground_clear_of_obstacles() {
        let layout = course();
        assert!(!layout.checkpoints.is_empty());
        for &x in &layout.checkpoints {
            for dx in [-DOG_HALF_SIZE.x, 0.0, DOG_HALF_SIZE.x] {
                assert_eq!(layout.surface_at(x + dx), Some(GROUND_TOP), "checkpoint at {x}");
            }
            for &h in &layout.hurdles {
                assert!((h - x).abs() > 150.0, "checkpoint at {x} is next to a hurdle");
            }
        }
    }

    #[test]
    fn no_cookie_is_inside_an_obstacle_or_out_of_reach() {
        let layout = course();
        let solids = layout.solids();
        let reach_above_surface = jump_height() + 2.0 * DOG_HALF_SIZE.y - MARGIN;
        for &c in &layout.cookies {
            let cookie_box = Aabb::from_center(c, Vec2::splat(COOKIE_RADIUS));
            for solid in &solids {
                if let Solid::Box(b) = solid {
                    assert!(!cookie_box.overlaps(b), "cookie at {c} is inside an obstacle");
                }
            }
            let below = layout.surface_at(c.x).unwrap_or(GROUND_TOP);
            assert!(
                c.y - COOKIE_RADIUS - below <= reach_above_surface,
                "cookie at {c} is out of reach"
            );
        }
    }

    #[test]
    fn finish_is_after_every_obstacle_and_run_takes_two_to_three_minutes() {
        let layout = course();
        let last_obstacle = layout
            .hurdles
            .iter()
            .copied()
            .chain(layout.tables.iter().map(|t| t.x1))
            .chain(layout.aframes.iter().map(|a| a.x0 + 2.0 * a.half_width))
            .chain(layout.gaps().iter().map(|g| g.1))
            .chain(layout.snowballs.iter().copied())
            .fold(f32::MIN, f32::max);
        assert!(layout.finish_x > last_obstacle);
        let seconds = (layout.finish_x - layout.start_x) / NORMAL_SCROLL_SPEED;
        assert!((120.0..=180.0).contains(&seconds), "run takes {seconds} s");
    }

    #[test]
    fn rebuilding_gives_the_same_course_again() {
        let mut app = rules_app_with(CourseLayout::christmas());
        let count = |app: &mut App| {
            app.world_mut()
                .query_filtered::<Entity, With<CourseEntity>>()
                .iter(app.world())
                .count()
        };
        let first = count(&mut app);
        assert!(first > 0);
        app.world_mut().resource_mut::<RestartRequested>().0 = true;
        step(&mut app, 0.0);
        assert_eq!(count(&mut app), first);
    }
}
