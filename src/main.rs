mod course;
mod hazards;
mod physics;
mod player;
mod rules;
mod visuals;

use bevy::{prelude::*, window::WindowResolution};

use rules::{RulesPlugin, WINDOW_HEIGHT, WINDOW_WIDTH};
use visuals::VisualsPlugin;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Agility Camp".to_string(),
                resolution: WindowResolution::new(WINDOW_WIDTH as u32, WINDOW_HEIGHT as u32),
                ..default()
            }),
            ..default()
        }))
        .add_plugins((RulesPlugin, VisualsPlugin))
        .add_systems(Update, exit_on_esc)
        .run();
}

fn exit_on_esc(keyboard_input: Res<ButtonInput<KeyCode>>, mut exit: MessageWriter<AppExit>) {
    if keyboard_input.just_pressed(KeyCode::Escape) {
        exit.write(AppExit::Success);
    }
}
