use bevy::{
    prelude::*,
    sprite::collide_aabb::{collide, Collision},
};
use rand::prelude::*;

#[derive(Component)]
struct Player {
    total_points: u32
}

#[derive(Component)]
struct Bone;

// Up and Down Movement Capability
#[derive(Component)]
struct UpAndDown;

// Back and Forth Movement Capability
#[derive(Component)]
struct BackAndForth;

#[derive(Component)]
struct Collidable;

const WINDOW_WIDTH: f32 = 1280.0;
const WINDOW_HEIGHT: f32 = 800.0;
const PLAYER_WIDTH: f32 = 120.0;
const PLAYER_HEIGHT: f32 = 200.0;
const BONE_WIDTH: f32 = 30.0;
const BONE_HEIGHT: f32 = 15.0;

const BACKGROUND_COLOR: Color = Color::rgb(0.3, 0.7, 1.0); // sky blue
const GROUND_COLOR: Color = Color::rgb(0.48, 98.8, 0.75); // light green

pub struct GamePlugin;

impl Plugin for GamePlugin {
    fn build(&self, app: &mut App) {
        app.add_startup_system(setup_camera)
            .add_startup_system(spawn_player)
            .add_startup_system(spawn_grass)
            .add_startup_system(bone_spawner)
            .add_system(player_movement)
            .add_system(bone_mover)
            .add_system(player_collide_with_bone)
            .add_system(bevy::input::system::exit_on_esc_system);
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
        //.insert(Collidable)
        .insert(Player{total_points: 0});
}

// System currently not in use!!!
fn up_and_down_movement(
    keyboard_input: Res<Input<KeyCode>>,
    mut positions: Query<&mut Transform, With<UpAndDown>>,
) {
    for mut transform in positions.iter_mut() {
        if keyboard_input.pressed(KeyCode::Up) {
            transform.translation.y += 2.;
        }
        if keyboard_input.pressed(KeyCode::Down) {
            transform.translation.y -= 2.;
        }
    }
}

// System currently not in use!!!
fn back_and_forth_movement(
    keyboard_input: Res<Input<KeyCode>>,
    mut positions: Query<&mut Transform, With<BackAndForth>>,
) {
    for mut transform in positions.iter_mut() {
        if keyboard_input.pressed(KeyCode::Left) {
            transform.translation.x -= 3.;
            continue;
        }
        if keyboard_input.pressed(KeyCode::Right) {
            transform.translation.x += 3.;
            continue;
        }
        transform.translation.x -= 1.5;
    }
}

fn player_movement(
    keyboard_input: Res<Input<KeyCode>>,
    mut positions: Query<&mut Transform, With<Player>>,
) {
    for mut transform in positions.iter_mut() {
        if keyboard_input.pressed(KeyCode::Space) {
            transform.translation.y += 3.;
            continue;
        }
        // Go down but not below ground
        if transform.translation.y > -300.0 {
            transform.translation.y -= 2.;
        }
    }
}

/// GRASS
fn spawn_grass(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands
        .spawn_bundle(SpriteBundle {
            sprite: Sprite {
                custom_size: Some(Vec2::new(1280.0, 70.0)),
                ..default()
            },
            texture: asset_server.load("sprites/grass.png"),
            transform: Transform::from_xyz(-0., -365., 1.),
            ..default()
        });
}


//// BONE
fn bone_spawner(mut commands: Commands, asset_server: Res<AssetServer>) {
    for _ in 1..10 {
        commands
            .spawn_bundle(SpriteBundle {
                sprite: Sprite {
                    custom_size: Some(Vec2::new(BONE_WIDTH, BONE_HEIGHT)),
                    ..default()
                },
                texture: asset_server.load("sprites/bone-yellow.png"),
                //transform: Transform::from_xyz(thread_rng().gen_range(-500.0..500.0), thread_rng().gen_range(-350.0..350.0), 0.),
                //transform: Transform { translation: Vec3::new(600.0, 15.0, 0.0), rotation: Quat::from_rotation_z(1.5,), scale: Vec3::new(1.0, 1.0, 1.0) },
                transform: Transform { 
                    translation: Vec3::new(thread_rng().gen_range(-500.0..500.0), thread_rng().gen_range(-350.0..350.0), 0.0),
                    rotation: Quat::from_rotation_z(thread_rng().gen_range(0.0..3.14),),
                    scale: Vec3::new(1.0, 1.0, 1.0)
                },
                ..default()
            })
            .insert(Bone);
    }
}

fn bone_mover(
    mut positions: Query<&mut Transform, With<Bone>>,
) {
    for mut transform in positions.iter_mut() {
        // X-AXIS
        transform.translation.x -= 2.;

        // ROTATION
        let rotation_delta = Quat::from_rotation_z(6.28 * 1.0/60.0);
        transform.rotation *= rotation_delta;
        //let (_, angle) = transform.rotation.to_axis_angle();
        //println!("angle: {} ", angle);
        //transform.rotate(Quat::from_rotation_z(angle + 0.1));
        // Rewind back to right incase object moves out of sight
        if transform.translation.x < -650.0 {
            transform.translation.x += 1280.0;
            transform.translation.y = thread_rng().gen_range(-350.0..350.0);
        }
    }
}

// Collision management
fn player_collide_with_bone(
    mut bone_query: Query<(&Bone, &mut Transform), Without<Player>>,
    player_query: Query<(&Player, &Transform), Without<Bone>>) { 
	// iterate through the Bones
	for (_, mut bone_tf) in bone_query.iter_mut() {
        // Check if the bone collides
        for (player, player_tf) in player_query.iter() {
            //println!("Player position: {}", player_tf.translation.y);     
            if collide(bone_tf.translation, Vec2::new(BONE_WIDTH, BONE_HEIGHT),Vec3::new(player_tf.translation.x, player_tf.translation.y-50.0, player_tf.translation.z), Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT/2.0)).is_some() {
                //println!("Collision happened at: {} {}", bone_tf.translation.x, bone_tf.translation.y);
                //player.total_points += 1;
                println!("points: {}", player.total_points);
                bone_tf.translation.x += 1000.0;
                bone_tf.translation.y = thread_rng().gen_range(-380.0..380.0);
            }
        }
    }
}

fn main() {
    App::new()
        .insert_resource(WindowDescriptor {
            title: "Agility Camp".to_string(),
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT,
            ..default()
        })
        .insert_resource(ClearColor(BACKGROUND_COLOR))
        .add_plugins(DefaultPlugins)
        .add_plugin(GamePlugin)
        .run();
}
