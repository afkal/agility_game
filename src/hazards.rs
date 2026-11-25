//! Hearts, the things that cost one, checkpoints and respawning.

use bevy::prelude::*;

use crate::course::{
    CheckpointMarker, CourseEntity, CourseLayout, FALL_LIMIT, GROUND_TOP, RestartRequested,
    SnowballSpawn,
};
use crate::physics::Aabb;
use crate::player::{Dog, HOME_FROM_LEFT_EDGE, home_x};
use crate::rules::{ScrollPosition, WINDOW_WIDTH, frame_delta};

pub const STARTING_HEARTS: u8 = 3;
/// After a respawn the dog cannot lose a heart for this long.
pub const RESPAWN_GRACE: f32 = 2.0;
pub const SNOWBALL_RADIUS: f32 = 22.0;
/// Snowballs roll towards the dog at this speed, in px/s.
pub const SNOWBALL_SPEED: f32 = 130.0;
const SNOWBALL_GRAVITY: f32 = 1200.0;
/// Snowball hits are checked against a slightly smaller box, so a near miss
/// counts as a miss.
const SNOWBALL_HIT_SHRINK: f32 = 6.0;

#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hearts(pub u8);

impl Default for Hearts {
    fn default() -> Self {
        Self(STARTING_HEARTS)
    }
}

/// X of the latest checkpoint the dog has passed, if any.
#[derive(Resource, Debug, Default, Clone, Copy, PartialEq)]
pub struct LatestCheckpoint(pub Option<f32>);

/// Seconds of respawn protection left.
#[derive(Resource, Debug, Default, Clone, Copy, PartialEq)]
pub struct RespawnGrace(pub f32);

#[derive(Component, Debug, Clone, Copy)]
pub struct Snowball {
    pub velocity: Vec2,
    pub radius: f32,
}

/// Marks a checkpoint the dog has passed, for the visuals.
#[derive(Component, Debug)]
pub struct CheckpointReached;

pub fn reset_hazards(commands: &mut Commands) {
    commands.insert_resource(Hearts::default());
    commands.insert_resource(LatestCheckpoint::default());
    commands.insert_resource(RespawnGrace::default());
}

pub fn spawn_due_snowballs(
    mut commands: Commands,
    scroll: Res<ScrollPosition>,
    spawns: Query<(Entity, &SnowballSpawn)>,
) {
    for (entity, spawn) in &spawns {
        if spawn.x <= scroll.right_edge() + SNOWBALL_RADIUS * 2.0 {
            commands.entity(entity).despawn();
            commands.spawn((
                CourseEntity,
                Snowball {
                    velocity: Vec2::new(-SNOWBALL_SPEED, 0.0),
                    radius: SNOWBALL_RADIUS,
                },
                Transform::from_xyz(spawn.x, GROUND_TOP + SNOWBALL_RADIUS, 6.0),
            ));
        }
    }
}

pub fn move_snowballs(
    mut commands: Commands,
    time: Res<Time>,
    scroll: Res<ScrollPosition>,
    layout: Res<CourseLayout>,
    mut snowballs: Query<(Entity, &mut Snowball, &mut Transform)>,
) {
    let dt = frame_delta(&time);
    for (entity, mut ball, mut transform) in &mut snowballs {
        transform.translation.x += ball.velocity.x * dt;
        let x = transform.translation.x;
        let resting_height = GROUND_TOP + ball.radius;
        let on_ground =
            layout.surface_at(x).is_some() && transform.translation.y >= resting_height - 0.01;
        if on_ground {
            ball.velocity.y = 0.0;
            transform.translation.y = resting_height;
        } else {
            ball.velocity.y -= SNOWBALL_GRAVITY * dt;
            transform.translation.y += ball.velocity.y * dt;
        }
        // Rolling snowballs turn slowly, for the visuals.
        transform.rotate_z(ball.velocity.x * dt / ball.radius);
        if transform.translation.y < FALL_LIMIT || x < scroll.left_edge() - 300.0 {
            commands.entity(entity).despawn();
        }
    }
}

pub fn track_checkpoints(
    mut commands: Commands,
    mut latest: ResMut<LatestCheckpoint>,
    dogs: Query<&Dog>,
    markers: Query<(Entity, &CheckpointMarker), Without<CheckpointReached>>,
) {
    let Ok(dog) = dogs.single() else { return };
    for (entity, marker) in &markers {
        if dog.body.center.x >= marker.x && dog.body.grounded {
            if latest.0.is_none_or(|x| marker.x > x) {
                latest.0 = Some(marker.x);
            }
            commands.entity(entity).insert(CheckpointReached);
        }
    }
}

/// Decide whether the dog loses a heart this frame, and handle the result.
#[allow(clippy::too_many_arguments)]
pub fn check_hazards(
    mut commands: Commands,
    time: Res<Time>,
    layout: Res<CourseLayout>,
    latest: Res<LatestCheckpoint>,
    mut hearts: ResMut<Hearts>,
    mut grace: ResMut<RespawnGrace>,
    mut scroll: ResMut<ScrollPosition>,
    mut restart: ResMut<RestartRequested>,
    mut dogs: Query<(&mut Dog, &mut Transform), Without<Snowball>>,
    snowballs: Query<(Entity, &Snowball, &Transform)>,
) {
    let Ok((mut dog, mut transform)) = dogs.single_mut() else {
        return;
    };
    grace.0 = (grace.0 - frame_delta(&time)).max(0.0);

    let fell = dog.body.center.y < FALL_LIMIT;
    let protected = grace.0 > 0.0;
    let caught_by_edge = !protected && dog.body.aabb().min.x < scroll.left_edge();
    let hit_snowball = !protected && {
        let dog_box = dog.body.aabb();
        snowballs.iter().any(|(_, ball, ball_transform)| {
            let half = Vec2::splat(ball.radius - SNOWBALL_HIT_SHRINK);
            Aabb::from_center(ball_transform.translation.truncate(), half).overlaps(&dog_box)
        })
    };
    if !(fell || caught_by_edge || hit_snowball) {
        return;
    }

    hearts.0 = hearts.0.saturating_sub(1);
    if hearts.0 == 0 {
        restart.0 = true;
        return;
    }

    let x = latest.0.unwrap_or(layout.start_x);
    let feet = Vec2::new(x, layout.surface_at(x).unwrap_or(GROUND_TOP));
    *dog = Dog::standing_at(feet);
    transform.translation.x = dog.body.center.x;
    transform.translation.y = dog.body.center.y;
    scroll.0 = x - HOME_FROM_LEFT_EDGE + WINDOW_WIDTH / 2.0;
    debug_assert!((home_x(&scroll) - x).abs() < 0.01);
    for (entity, _, _) in &snowballs {
        commands.entity(entity).despawn();
    }
    grace.0 = RESPAWN_GRACE;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course::HURDLE_WIDTH;
    use crate::rules::test_support::*;

    fn dog(app: &mut App) -> Dog {
        app.world_mut()
            .query::<&Dog>()
            .single(app.world())
            .unwrap()
            .clone()
    }

    fn hearts(app: &App) -> u8 {
        app.world().resource::<Hearts>().0
    }

    /// Step frame by frame until a heart is lost, then return where the dog is.
    fn run_until_heart_lost(app: &mut App, max_seconds: f32) -> Dog {
        let start = hearts(app);
        let mut t = 0.0;
        while hearts(app) == start {
            assert!(t < max_seconds, "no heart lost within {max_seconds} s");
            step(app, 1.0 / 60.0);
            t += 1.0 / 60.0;
        }
        dog(app)
    }

    fn tap_space(app: &mut App) {
        press(app, KeyCode::Space);
        step(app, 1.0 / 60.0);
        release_all(app);
    }

    /// Flat ground with a gap at 600..720 and checkpoints at 100 and 300.
    fn gap_course() -> CourseLayout {
        CourseLayout {
            ground: vec![(-1_000.0, 600.0), (720.0, 50_000.0)],
            checkpoints: vec![100.0, 300.0],
            start_x: 0.0,
            finish_x: 40_000.0,
            ..default()
        }
    }

    fn hurdle_course() -> CourseLayout {
        CourseLayout {
            hurdles: vec![400.0],
            ..CourseLayout::flat(50_000.0)
        }
    }

    fn snowball_course() -> CourseLayout {
        CourseLayout {
            snowballs: vec![900.0],
            ..CourseLayout::flat(50_000.0)
        }
    }

    #[test]
    fn falling_into_a_gap_costs_a_heart_and_respawns_at_latest_checkpoint() {
        let mut app = rules_app_with(gap_course());
        let d = run_until_heart_lost(&mut app, 6.0);
        assert_eq!(hearts(&app), 2);
        assert!(
            (d.body.center.x - 300.0).abs() < 1.0,
            "respawned at {}",
            d.body.center.x
        );
        assert!(d.body.grounded);
    }

    #[test]
    fn blocked_by_hurdle_until_edge_arrives_costs_a_heart() {
        let mut app = rules_app_with(hurdle_course());
        run_for(&mut app, 2.5);
        assert!(dog(&mut app).blocked);
        assert_eq!(hearts(&app), 3);
        let d = run_until_heart_lost(&mut app, 6.0);
        assert_eq!(hearts(&app), 2);
        // No checkpoint passed: back to the start.
        assert!(d.body.center.x.abs() < 1.0);
    }

    #[test]
    fn touching_a_hurdle_then_jumping_over_it_costs_nothing() {
        let mut app = rules_app_with(hurdle_course());
        run_for(&mut app, 2.5);
        assert!(dog(&mut app).blocked);
        tap_space(&mut app);
        run_for(&mut app, 3.0);
        assert_eq!(hearts(&app), 3);
        assert!(dog(&mut app).body.center.x > 400.0 + HURDLE_WIDTH);
    }

    #[test]
    fn touching_a_rolling_snowball_costs_a_heart() {
        let mut app = rules_app_with(snowball_course());
        run_for(&mut app, 4.0);
        assert_eq!(hearts(&app), 2);
    }

    #[test]
    fn snowball_during_respawn_grace_costs_nothing() {
        let mut app = rules_app_with(snowball_course());
        app.world_mut().resource_mut::<RespawnGrace>().0 = 100.0;
        run_for(&mut app, 4.0);
        assert_eq!(hearts(&app), 3);
    }

    #[test]
    fn losing_the_last_heart_restarts_the_course() {
        let mut app = rules_app_with(snowball_course());
        app.world_mut().resource_mut::<Hearts>().0 = 1;
        app.world_mut().resource_mut::<LatestCheckpoint>().0 = Some(500.0);
        run_for(&mut app, 4.0);
        assert_eq!(hearts(&app), 3);
        assert_eq!(app.world().resource::<LatestCheckpoint>().0, None);
        let d = dog(&mut app);
        assert!(d.body.center.x < 300.0, "dog at {}", d.body.center.x);
    }

    #[test]
    fn heart_lost_before_any_checkpoint_respawns_at_start() {
        let mut app = rules_app_with(CourseLayout {
            ground: vec![(-1_000.0, 200.0), (320.0, 50_000.0)],
            start_x: 0.0,
            finish_x: 40_000.0,
            ..default()
        });
        let d = run_until_heart_lost(&mut app, 6.0);
        assert_eq!(hearts(&app), 2);
        assert!(d.body.center.x.abs() < 1.0);
    }
}
