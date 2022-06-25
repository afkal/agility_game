use bevy::prelude::*;
use rand::prelude::random;

#[derive(Component)]
struct Player;

#[derive(Component)]
struct Bone;

const WINDOW_WIDTH: f32 = 1280.0;
const WINDOW_HEIGHT: f32 = 800.0;
const PLAYER_WIDTH: f32 = 120.0;
const PLAYER_HEIGHT: f32 = 200.0;

const BACKGROUND_COLOR: Color = Color::rgb(0.3, 0.7, 1.0); // sky blue
const GROUND_COLOR: Color = Color::rgb(0.48, 98.8, 0.75); // light green

pub struct GamePlugin;

impl Plugin for GamePlugin {
    fn build(&self, app: &mut App) {
        app.add_startup_system(setup_camera)
        .add_startup_system(spawn_player)
        .add_startup_system(bone_spawner)
        .add_system(player_movement);
    }
}

fn setup_camera(mut commands: Commands) {
    commands.spawn_bundle(OrthographicCameraBundle::new_2d());
}

//// PLAYER
fn spawn_player(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands
        .spawn_bundle(SpriteBundle {
            sprite: Sprite {
                custom_size: Some(Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT)),
                ..default()
            },
            texture: asset_server.load("sprites/dog-with-balloons-white.png"),
            transform: Transform::from_xyz(-400., 0., 0.),
            ..default()
        })
        .insert(Player);
}

fn player_movement(keyboard_input: Res<Input<KeyCode>>, 
    mut positions: Query<&mut Transform, With<Player>>) {
    for mut transform in positions.iter_mut() {
        if keyboard_input.pressed(KeyCode::Up) {
            transform.translation.y += 2.;
        }
        if keyboard_input.pressed(KeyCode::Down) {
            transform.translation.y -= 2.;
        }
    }
}

//// BONE
fn bone_spawner(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands
        .spawn_bundle(SpriteBundle {
            sprite: Sprite {
                custom_size: Some(Vec2::new(30.0, 15.0)),
                ..default()
            },
            texture: asset_server.load("sprites/bone-yellow.png"),
            //transform: Transform::from_xyz(400., 0., 0.),
            ..default()
        })
        .insert(Bone);
}

fn main() {
    App::new()
    .insert_resource(WindowDescriptor {
        title: "Aksaleiri 1.0".to_string(),
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        ..default()
    })
    .insert_resource(ClearColor(BACKGROUND_COLOR))
    .add_plugins(DefaultPlugins)
    .add_plugin(GamePlugin)
    .run();
}