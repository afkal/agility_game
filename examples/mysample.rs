use bevy::{prelude::*, window::WindowResolution};

#[derive(Component)]
struct Player;

#[derive(Component)]
struct Bone;

const WINDOW_WIDTH: u32 = 1280;
const WINDOW_HEIGHT: u32 = 800;
const PLAYER_WIDTH: f32 = 120.0;
const PLAYER_HEIGHT: f32 = 200.0;

const BACKGROUND_COLOR: Color = Color::srgb(0.3, 0.7, 1.0); // sky blue
const GROUND_COLOR: Color = Color::srgb(0.48, 98.8, 0.75); // light green

pub struct GamePlugin;

impl Plugin for GamePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, (setup_camera, spawn_player, bone_spawner))
            .add_systems(Update, player_movement);
    }
}

fn setup_camera(mut commands: Commands) {
    commands.spawn(Camera2d);
}

//// PLAYER
fn spawn_player(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn((
        Sprite {
            image: asset_server.load("sprites/dog-with-balloons-white.png"),
            custom_size: Some(Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT)),
            ..default()
        },
        Transform::from_xyz(-400., 0., 0.),
        Player,
    ));
}

fn player_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut positions: Query<&mut Transform, With<Player>>,
) {
    for mut transform in positions.iter_mut() {
        if keyboard_input.pressed(KeyCode::ArrowUp) {
            transform.translation.y += 2.;
        }
        if keyboard_input.pressed(KeyCode::ArrowDown) {
            transform.translation.y -= 2.;
        }
    }
}

//// BONE
fn bone_spawner(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn((
        Sprite {
            image: asset_server.load("sprites/bone-yellow.png"),
            custom_size: Some(Vec2::new(30.0, 15.0)),
            ..default()
        },
        Bone,
    ));
}

fn main() {
    App::new()
        .insert_resource(ClearColor(BACKGROUND_COLOR))
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Aksaleiri 1.0".to_string(),
                resolution: WindowResolution::new(WINDOW_WIDTH, WINDOW_HEIGHT),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(GamePlugin)
        .run();
}
