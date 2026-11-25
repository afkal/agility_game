//! The dog: jumping, running with the scroll and catching up after a stop.

use bevy::prelude::*;

use crate::physics::{self, Body, Solid};
use crate::rules::{ScrollPosition, ScrollSpeed, WINDOW_WIDTH, frame_delta};

pub const GRAVITY: f32 = 1800.0;
pub const JUMP_VELOCITY: f32 = 800.0;

/// The dog's collision box (body and feet), smaller than its picture.
pub const DOG_HALF_SIZE: Vec2 = Vec2::new(30.0, 34.0);

/// Where the dog normally runs, measured from the left edge of the view.
pub const HOME_FROM_LEFT_EDGE: f32 = 320.0;

/// How strongly the dog runs back towards its home position after being held
/// back, and the most extra speed it uses for that.
const CATCH_UP_GAIN: f32 = 3.0;
const MAX_CATCH_UP_SPEED: f32 = 160.0;

/// A jump still works for this long after running off an edge.
pub const COYOTE_TIME: f32 = 0.1;
/// A jump pressed this long before landing still fires on landing.
pub const JUMP_BUFFER_TIME: f32 = 0.12;

/// Course geometry the dog collides with.
#[derive(Resource, Default, Debug, Clone)]
pub struct CourseSolids(pub Vec<Solid>);

#[derive(Component, Debug, Clone)]
pub struct Dog {
    pub body: Body,
    /// Time left in which a jump still counts as from the ground.
    pub coyote: f32,
    /// Time left in which a recent jump press is still waiting to fire.
    pub jump_buffer: f32,
    /// The dog tried to run forward this frame and an obstacle stopped it.
    pub blocked: bool,
}

impl Dog {
    pub fn standing_at(feet: Vec2) -> Self {
        Self {
            body: Body {
                center: feet + Vec2::new(0.0, DOG_HALF_SIZE.y),
                half: DOG_HALF_SIZE,
                velocity: Vec2::ZERO,
                grounded: true,
            },
            coyote: COYOTE_TIME,
            jump_buffer: 0.0,
            blocked: false,
        }
    }

    /// Move the entity's transform to where the dog's body is.
    pub fn sync_transform(&self, transform: &mut Transform) {
        transform.translation.x = self.body.center.x;
        transform.translation.y = self.body.center.y;
    }
}

pub fn home_x(scroll: &ScrollPosition) -> f32 {
    scroll.left_edge() + HOME_FROM_LEFT_EDGE
}

/// The scroll position that puts the dog's home at world `x`.
pub fn scroll_with_home_at(x: f32) -> ScrollPosition {
    ScrollPosition(x - HOME_FROM_LEFT_EDGE + WINDOW_WIDTH / 2.0)
}

pub fn buffer_jump_input(keyboard_input: Res<ButtonInput<KeyCode>>, mut dogs: Query<&mut Dog>) {
    if keyboard_input.just_pressed(KeyCode::Space) {
        for mut dog in &mut dogs {
            dog.jump_buffer = JUMP_BUFFER_TIME;
        }
    }
}

pub fn move_dog(
    time: Res<Time>,
    speed: Res<ScrollSpeed>,
    scroll: Res<ScrollPosition>,
    solids: Res<CourseSolids>,
    mut dogs: Query<(&mut Dog, &mut Transform)>,
) {
    let dt = frame_delta(&time);
    if dt <= 0.0 {
        return;
    }
    let home = home_x(&scroll);
    for (mut dog, mut transform) in &mut dogs {
        // The view has already moved this frame, so `behind` includes this
        // frame's scroll distance. Never run past home: at home the dog just
        // keeps pace with the scroll.
        let behind = home - dog.body.center.x;
        let catch_up = (behind * CATCH_UP_GAIN).clamp(0.0, MAX_CATCH_UP_SPEED);
        let to_home = (behind / dt).max(0.0);
        dog.body.velocity.x = (speed.0 + catch_up).min(to_home);

        if dog.jump_buffer > 0.0 && (dog.body.grounded || dog.coyote > 0.0) {
            dog.body.velocity.y = JUMP_VELOCITY;
            dog.body.grounded = false;
            dog.jump_buffer = 0.0;
            dog.coyote = 0.0;
        }

        let outcome = physics::step(&mut dog.body, &solids.0, GRAVITY, dt);
        dog.blocked = outcome.blocked;

        if dog.body.grounded {
            dog.coyote = COYOTE_TIME;
        } else {
            dog.coyote = (dog.coyote - dt).max(0.0);
        }
        dog.jump_buffer = (dog.jump_buffer - dt).max(0.0);

        dog.sync_transform(&mut transform);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::physics::Aabb;
    use crate::rules::test_support::*;

    const GROUND_TOP: f32 = -300.0;

    fn ground(from: f32, to: f32) -> Solid {
        Solid::Box(Aabb {
            min: Vec2::new(from, -400.0),
            max: Vec2::new(to, GROUND_TOP),
        })
    }

    /// Rules app with the given solids and a dog standing at its home position.
    fn app_with(solids: Vec<Solid>) -> (App, Entity) {
        let mut app = rules_app();
        let course_dogs: Vec<Entity> = app
            .world_mut()
            .query_filtered::<Entity, With<Dog>>()
            .iter(app.world())
            .collect();
        for entity in course_dogs {
            app.world_mut().despawn(entity);
        }
        app.insert_resource(CourseSolids(solids));
        let home = home_x(app.world().resource::<ScrollPosition>());
        let dog = app
            .world_mut()
            .spawn((
                Dog::standing_at(Vec2::new(home, GROUND_TOP)),
                Transform::default(),
            ))
            .id();
        (app, dog)
    }

    fn dog(app: &App, entity: Entity) -> Dog {
        app.world().get::<Dog>(entity).unwrap().clone()
    }

    fn tap_space(app: &mut App) {
        press(app, KeyCode::Space);
        step(app, 1.0 / 60.0);
        release_all(app);
    }

    #[test]
    fn space_makes_the_dog_jump_and_land() {
        let (mut app, entity) = app_with(vec![ground(-5_000.0, 50_000.0)]);
        tap_space(&mut app);
        run_for(&mut app, 0.2);
        assert!(dog(&app, entity).body.bottom() > GROUND_TOP + 50.0);
        run_for(&mut app, 1.5);
        let d = dog(&app, entity);
        assert!(d.body.grounded);
        assert!((d.body.bottom() - GROUND_TOP).abs() < 0.01);
    }

    #[test]
    fn dog_runs_with_the_scroll_at_home_position() {
        let (mut app, entity) = app_with(vec![ground(-5_000.0, 50_000.0)]);
        run_for(&mut app, 2.0);
        let home = home_x(app.world().resource::<ScrollPosition>());
        assert!((dog(&app, entity).body.center.x - home).abs() < 2.0);
    }

    #[test]
    fn blocked_dog_falls_behind_while_the_view_moves_on() {
        let (mut app, entity) = app_with(vec![ground(-5_000.0, 50_000.0)]);
        let home_start = home_x(app.world().resource::<ScrollPosition>());
        let wall_x = home_start + 100.0;
        app.insert_resource(CourseSolids(vec![
            ground(-5_000.0, 50_000.0),
            Solid::Box(Aabb {
                min: Vec2::new(wall_x, GROUND_TOP),
                max: Vec2::new(wall_x + 16.0, GROUND_TOP + 45.0),
            }),
        ]));
        run_for(&mut app, 1.5);
        let d = dog(&app, entity);
        assert!(d.blocked);
        assert!((d.body.center.x + DOG_HALF_SIZE.x - wall_x).abs() < 0.01);
        let home = home_x(app.world().resource::<ScrollPosition>());
        assert!(home > d.body.center.x + 100.0);
    }

    #[test]
    fn dog_catches_up_faster_than_scroll_and_stops_at_home() {
        let (mut app, entity) = app_with(vec![ground(-5_000.0, 50_000.0)]);
        app.world_mut()
            .get_mut::<Dog>(entity)
            .unwrap()
            .body
            .center
            .x -= 300.0;
        let start_gap = {
            let home = home_x(app.world().resource::<ScrollPosition>());
            home - dog(&app, entity).body.center.x
        };
        run_for(&mut app, 0.25);
        let gap_after =
            home_x(app.world().resource::<ScrollPosition>()) - dog(&app, entity).body.center.x;
        assert!(
            gap_after < start_gap - 20.0,
            "gap {start_gap} -> {gap_after}"
        );
        run_for(&mut app, 4.0);
        let d = dog(&app, entity);
        let home = home_x(app.world().resource::<ScrollPosition>());
        assert!(d.body.center.x <= home + 0.5);
        assert!(home - d.body.center.x < 2.0);
    }

    #[test]
    fn jump_just_after_running_off_an_edge_still_fires() {
        let (mut app, entity) = app_with(vec![]);
        let home = home_x(app.world().resource::<ScrollPosition>());
        // Ground ends just behind the dog's back edge, so it steps off at once.
        let edge = home + DOG_HALF_SIZE.x;
        app.insert_resource(CourseSolids(vec![ground(
            -5_000.0,
            edge - 2.0 * DOG_HALF_SIZE.x + 3.0,
        )]));
        step(&mut app, 1.0 / 60.0);
        step(&mut app, 1.0 / 60.0);
        assert!(
            !dog(&app, entity).body.grounded,
            "dog should have left the ground"
        );
        tap_space(&mut app);
        assert!(
            dog(&app, entity).body.velocity.y > 0.0,
            "coyote jump did not fire"
        );
    }

    #[test]
    fn jump_pressed_just_before_landing_fires_on_landing() {
        let (mut app, entity) = app_with(vec![ground(-5_000.0, 50_000.0)]);
        // About 0.09 s of falling left, inside the jump buffer window.
        app.world_mut()
            .get_mut::<Dog>(entity)
            .unwrap()
            .body
            .center
            .y += 8.0;
        app.world_mut()
            .get_mut::<Dog>(entity)
            .unwrap()
            .body
            .grounded = false;
        app.world_mut().get_mut::<Dog>(entity).unwrap().coyote = 0.0;
        tap_space(&mut app);
        run_for(&mut app, 0.15);
        assert!(
            dog(&app, entity).body.bottom() > GROUND_TOP + 20.0,
            "buffered jump did not fire on landing"
        );
    }
}
