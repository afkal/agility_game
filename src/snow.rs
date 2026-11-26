//! Snowflakes drifting down over the whole view. Purely decorative.

use bevy::prelude::*;

use crate::art::Painter;
use crate::rules::{WINDOW_HEIGHT, WINDOW_WIDTH};
use crate::visuals::{MainCamera, spawn_camera};

const FLAKE_COUNT: usize = 140;
const FLAKE_Z: f32 = 40.0;

pub struct SnowPlugin;

impl Plugin for SnowPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_snow.after(spawn_camera))
            .add_systems(Update, drift_snow);
    }
}

#[derive(Component)]
struct Flake {
    fall_speed: f32,
    sway: f32,
    phase: f32,
}

fn spawn_snow(
    mut commands: Commands,
    mut painter: Painter,
    camera: Query<Entity, With<MainCamera>>,
) {
    let Ok(camera) = camera.single() else { return };
    commands.entity(camera).with_children(|parent| {
        for _ in 0..FLAKE_COUNT {
            let size = rand::random_range(1.5..4.5);
            let alpha = rand::random_range(0.55..0.95);
            let pos = Vec3::new(
                rand::random_range(-WINDOW_WIDTH / 2.0..WINDOW_WIDTH / 2.0),
                rand::random_range(-WINDOW_HEIGHT / 2.0..WINDOW_HEIGHT / 2.0),
                FLAKE_Z,
            );
            parent.spawn((
                Flake {
                    // Bigger flakes are "closer" and fall faster.
                    fall_speed: 25.0 + size * 14.0,
                    sway: rand::random_range(8.0..22.0),
                    phase: rand::random_range(0.0..std::f32::consts::TAU),
                },
                painter.circle(size, Color::srgba(1.0, 1.0, 1.0, alpha), pos),
            ));
        }
    });
}

fn drift_snow(time: Res<Time>, mut flakes: Query<(&Flake, &mut Transform)>) {
    let dt = time.delta_secs();
    let t = time.elapsed_secs();
    for (flake, mut transform) in &mut flakes {
        transform.translation.y -= flake.fall_speed * dt;
        transform.translation.x += (t * 0.8 + flake.phase).cos() * flake.sway * dt;
        if transform.translation.y < -WINDOW_HEIGHT / 2.0 - 10.0 {
            transform.translation.y += WINDOW_HEIGHT + 20.0;
            transform.translation.x = rand::random_range(-WINDOW_WIDTH / 2.0..WINDOW_WIDTH / 2.0);
        }
    }
}
