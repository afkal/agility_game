//! Presentation: camera, colours and shapes drawn on top of the rule entities.

use bevy::prelude::*;

use crate::hud::HudPlugin;
use crate::rules::ScrollPosition;

/// Medium winter-sky blue. The black dog silhouette reads clearly against it,
/// and white snowflakes stay visible.
const SKY_COLOR: Color = Color::srgb(0.45, 0.68, 0.92);

pub struct VisualsPlugin;

impl Plugin for VisualsPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(HudPlugin)
            .insert_resource(ClearColor(SKY_COLOR))
            .add_systems(Startup, spawn_camera)
            .add_systems(PostUpdate, follow_scroll.before(TransformSystems::Propagate));
    }
}

#[derive(Component)]
pub struct MainCamera;

pub fn spawn_camera(mut commands: Commands) {
    commands.spawn((Camera2d, MainCamera));
}

fn follow_scroll(scroll: Res<ScrollPosition>, mut camera: Query<&mut Transform, With<MainCamera>>) {
    for mut transform in &mut camera {
        transform.translation.x = scroll.0;
    }
}
