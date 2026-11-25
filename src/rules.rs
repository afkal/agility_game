//! Game rules: everything that decides what happens in the level.
//!
//! Nothing in here touches rendering or assets, so the whole rule set can run
//! inside a headless `App` in tests. Presentation lives in `visuals`.

use bevy::prelude::*;

use crate::collect::{
    check_finish, collect_cookies, play_again, CelebrationTime, GingerbreadCount,
};
use crate::course::{rebuild_course, CourseLayout, RestartRequested};
use crate::hazards::{
    check_hazards, move_snowballs, spawn_due_snowballs, track_checkpoints, Hearts, LatestCheckpoint,
    RespawnGrace,
};
use crate::player::{buffer_jump_input, move_dog, CourseSolids};

pub const WINDOW_WIDTH: f32 = 1280.0;
pub const WINDOW_HEIGHT: f32 = 800.0;

/// Scroll speed range in pixels per second. The slowest pace is calm on
/// purpose: the player should never feel rushed.
pub const MIN_SCROLL_SPEED: f32 = 140.0;
pub const NORMAL_SCROLL_SPEED: f32 = 200.0;
pub const MAX_SCROLL_SPEED: f32 = 300.0;
/// How quickly holding an arrow key changes the pace, in px/s per second.
pub const SCROLL_ACCELERATION: f32 = 150.0;

/// Longest frame time the rules will simulate in one step. A stall longer than
/// this is simulated as if it were this long, so nothing tunnels through thin
/// obstacles after a hiccup.
pub const MAX_FRAME_DELTA: f32 = 1.0 / 30.0;

#[derive(States, Default, Clone, Copy, Eq, PartialEq, Hash, Debug)]
pub enum GameState {
    #[default]
    Playing,
    Finished,
}

/// Current scroll pace in pixels per second.
#[derive(Resource, Debug, Clone, Copy, PartialEq)]
pub struct ScrollSpeed(pub f32);

impl Default for ScrollSpeed {
    fn default() -> Self {
        Self(NORMAL_SCROLL_SPEED)
    }
}

/// World x coordinate of the centre of the view. The camera follows this.
#[derive(Resource, Debug, Clone, Copy, PartialEq, Default)]
pub struct ScrollPosition(pub f32);

impl ScrollPosition {
    pub fn left_edge(&self) -> f32 {
        self.0 - WINDOW_WIDTH / 2.0
    }

    pub fn right_edge(&self) -> f32 {
        self.0 + WINDOW_WIDTH / 2.0
    }
}

/// Frame time used by the rules, clamped so a long stall cannot make objects
/// jump too far in one step.
pub fn frame_delta(time: &Time) -> f32 {
    time.delta_secs().min(MAX_FRAME_DELTA)
}

pub struct RulesPlugin;

impl Plugin for RulesPlugin {
    fn build(&self, app: &mut App) {
        if !app.world().contains_resource::<CourseLayout>() {
            app.insert_resource(CourseLayout::christmas());
        }
        app.init_state::<GameState>()
            .init_resource::<RestartRequested>()
            .init_resource::<ScrollSpeed>()
            .init_resource::<ScrollPosition>()
            .init_resource::<CourseSolids>()
            .init_resource::<Hearts>()
            .init_resource::<LatestCheckpoint>()
            .init_resource::<RespawnGrace>()
            .init_resource::<GingerbreadCount>()
            .init_resource::<CelebrationTime>()
            .add_systems(PreUpdate, rebuild_course)
            .add_systems(
                Update,
                (
                    adjust_scroll_speed,
                    advance_scroll,
                    buffer_jump_input,
                    move_dog,
                    spawn_due_snowballs,
                    move_snowballs,
                    track_checkpoints,
                    check_hazards,
                    collect_cookies,
                    check_finish,
                )
                    .chain()
                    .run_if(in_state(GameState::Playing)),
            )
            .add_systems(Update, play_again.run_if(in_state(GameState::Finished)));
    }
}

fn adjust_scroll_speed(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut speed: ResMut<ScrollSpeed>,
) {
    let dt = frame_delta(&time);
    let mut change = 0.0;
    if keyboard_input.pressed(KeyCode::ArrowRight) {
        change += SCROLL_ACCELERATION * dt;
    }
    if keyboard_input.pressed(KeyCode::ArrowLeft) {
        change -= SCROLL_ACCELERATION * dt;
    }
    speed.0 = (speed.0 + change).clamp(MIN_SCROLL_SPEED, MAX_SCROLL_SPEED);
}

fn advance_scroll(time: Res<Time>, speed: Res<ScrollSpeed>, mut position: ResMut<ScrollPosition>) {
    position.0 += speed.0 * frame_delta(&time);
}

#[cfg(test)]
pub mod test_support {
    use std::time::Duration;

    use bevy::{state::app::StatesPlugin, time::TimeUpdateStrategy};

    use super::*;

    /// A headless app running only the rules on a long flat course, with time
    /// advanced by hand.
    pub fn rules_app() -> App {
        rules_app_with(CourseLayout::flat(50_000.0))
    }

    /// Like `rules_app`, on the given course.
    pub fn rules_app_with(layout: CourseLayout) -> App {
        let mut app = App::new();
        app.insert_resource(layout);
        app.add_plugins((MinimalPlugins, StatesPlugin))
            .init_resource::<ButtonInput<KeyCode>>()
            .add_plugins(RulesPlugin);
        // The first update initialises time and states without advancing.
        app.insert_resource(TimeUpdateStrategy::ManualDuration(Duration::ZERO));
        app.update();
        app
    }

    /// Run one update that advances time by `seconds`.
    pub fn step(app: &mut App, seconds: f32) {
        app.insert_resource(TimeUpdateStrategy::ManualDuration(Duration::from_secs_f32(
            seconds,
        )));
        app.update();
    }

    /// Run updates of at most one clamped frame each until `seconds` have passed.
    pub fn run_for(app: &mut App, seconds: f32) {
        let frame = 1.0 / 60.0;
        let mut remaining = seconds;
        while remaining > 1e-6 {
            let dt = remaining.min(frame);
            step(app, dt);
            remaining -= dt;
        }
    }

    pub fn press(app: &mut App, key: KeyCode) {
        app.world_mut().resource_mut::<ButtonInput<KeyCode>>().press(key);
    }

    pub fn release_all(app: &mut App) {
        let mut input = app.world_mut().resource_mut::<ButtonInput<KeyCode>>();
        input.release_all();
        input.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;

    fn speed(app: &App) -> f32 {
        app.world().resource::<ScrollSpeed>().0
    }

    fn position(app: &App) -> f32 {
        app.world().resource::<ScrollPosition>().0
    }

    #[test]
    fn right_arrow_raises_speed_but_not_above_maximum() {
        let mut app = rules_app();
        press(&mut app, KeyCode::ArrowRight);
        run_for(&mut app, 1.0);
        assert!(speed(&app) > NORMAL_SCROLL_SPEED);
        run_for(&mut app, 10.0);
        assert_eq!(speed(&app), MAX_SCROLL_SPEED);
    }

    #[test]
    fn left_arrow_lowers_speed_to_minimum_and_never_to_zero() {
        let mut app = rules_app();
        press(&mut app, KeyCode::ArrowLeft);
        run_for(&mut app, 10.0);
        assert_eq!(speed(&app), MIN_SCROLL_SPEED);
        assert!(speed(&app) > 0.0);
    }

    #[test]
    fn scroll_advances_by_speed_times_time() {
        let mut app = rules_app();
        let start = position(&app);
        run_for(&mut app, 0.5);
        assert!((position(&app) - start - 100.0).abs() < 0.01);
    }

    #[test]
    fn long_frame_stall_is_clamped() {
        let mut app = rules_app();
        let start = position(&app);
        step(&mut app, 1.0);
        let moved = position(&app) - start;
        assert!((moved - NORMAL_SCROLL_SPEED * MAX_FRAME_DELTA).abs() < 0.01);
    }

    #[test]
    fn scroll_stops_when_finished() {
        let mut app = rules_app();
        app.world_mut()
            .resource_mut::<NextState<GameState>>()
            .set(GameState::Finished);
        step(&mut app, 0.0);
        let start = position(&app);
        run_for(&mut app, 0.5);
        assert_eq!(position(&app), start);
    }
}
