use bevy::{
    prelude::*,
    sprite::collide_aabb::{collide, Collision},
};
use rand::prelude::*;

// Start: --- Resources
struct TotalPoints(u32);
// End: --- Resources

// Start: --- Components
#[derive(Component)]
struct Player;

#[derive(Component)]
struct Bone;

#[derive(Component)]
struct Points;

// Up and Down Movement Capability
#[derive(Component)]
struct UpAndDown;

// Back and Forth Movement Capability
#[derive(Component)]
struct BackAndForth;

// Floats with provided speed from right to left and back again
#[derive(Component)]
struct Floater(f32);

#[derive(Component)]
struct Hawk(f32);

#[derive(Component)]
struct Collidable;
// End: --- Components
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
        app.add_startup_system(setup_game)
            .add_startup_system(spawn_player)
            .add_startup_system(spawn_grass)
            .add_startup_system(spawn_cloud)
            .add_startup_system(spawn_points)
            .add_startup_system(bone_spawner)
            .add_system(player_movement)
            //.add_system(back_and_forth_movement)
            .add_system(bone_mover)
            .add_system(hawk_mover)
            .add_system(float_right)
            .add_system(player_collide_with_bone)
            .add_system(player_collide_with_hawk)
            .add_system(update_points)
            .add_system(hawk_spawner)
            .add_system(bevy::input::system::exit_on_esc_system);
    }
}

fn setup_game(mut commands: Commands) {
    commands.spawn_bundle(OrthographicCameraBundle::new_2d()); // needed for graphics
    commands.spawn_bundle(UiCameraBundle::default()); // needed for (text) ui
    commands.insert_resource(TotalPoints(0));
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
            transform: Transform::from_xyz(-400., 0., 10.),
            ..default()
        })
        //.insert(BackAndForth)
        .insert(Player);
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
        /*
        if keyboard_input.pressed(KeyCode::Left) {
            transform.translation.x -= 3.;
            continue;
        }
        */
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
            // Go up but not too high
            if transform.translation.y > 300.0 {
                transform.translation.y = 300.;
            }
            continue;
        }
        // Go down but not below ground
        if transform.translation.y > -300.0 {
            transform.translation.y -= 2.;
        }
    }
}

/// POINTS
fn spawn_points(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn_bundle(TextBundle {
        style: Style {
            align_self: AlignSelf::FlexEnd,
            position_type: PositionType::Absolute,
            position: Rect {
                top: Val::Px(5.0),
                right: Val::Px(15.0),
                ..default()
            },
            ..default()
        },
        // Use the `Text::with_section` constructor
        text: Text::with_section(
            // Accepts a `String` or any type that converts into a `String`, such as `&str`
            "Bones: 0",
            TextStyle {
                font: asset_server.load("fonts/FiraSans-Bold.ttf"),
                font_size: 30.0,
                color: Color::WHITE,
            },
            // Note: You can use `Default::default()` in place of the `TextAlignment`
            TextAlignment {
                horizontal: HorizontalAlign::Center,
                ..default()
            },
        ),
        ..default()
    })
    .insert(Points);
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
            transform: Transform::from_xyz(-0., -365., 20.),
            ..default()
        });
}


/// Cloud
fn spawn_cloud(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands
        .spawn_bundle(SpriteBundle {
            sprite: Sprite {
                custom_size: Some(Vec2::new(400.0, 200.0)),
                ..default()
            },
            texture: asset_server.load("sprites/cloud.png"),
            transform: Transform::from_xyz(800., 300., 0.),
            ..default()
        })
        .insert(Floater(0.2));
}

/// Hawk
fn spawn_hawk(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands
        .spawn_bundle(SpriteBundle {
            sprite: Sprite {
                custom_size: Some(Vec2::new(60.0, 60.0)),
                ..default()
            },
            texture: asset_server.load("sprites/hawk.png"),
            transform: Transform::from_xyz(800., thread_rng().gen_range(-200.0..400.0), 1.),
            ..default()
        })
        .insert(Hawk(thread_rng().gen_range(2.5..4.5)));
}

fn hawk_spawner(mut commands: Commands, asset_server: Res<AssetServer>) {
    let randomizer: f32 = thread_rng().gen_range(-0.0..1000.0);
    if randomizer > 999.0 {
        spawn_hawk(commands, asset_server); 
    }    
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

fn float_right(mut positions: Query<(&mut Transform, &Floater), With<Floater>>) {
    for (mut transform, speed) in positions.iter_mut() {
        transform.translation.x -= speed.0 ;
        if transform.translation.x < -800.0 {
            transform.translation.x += 1600.0;
        }
    }
}

fn hawk_mover(mut positions: Query<(&mut Transform, &Hawk), With<Hawk>>) {
    for (mut transform, speed) in positions.iter_mut() {
        transform.translation.x -= speed.0 ;
        if transform.translation.x < -800.0 {
            transform.translation.x += 1600.0;
            transform.translation.y = thread_rng().gen_range(-300.0..350.0);
        }
    }
}

// Collision management
fn player_collide_with_bone(
    mut total_points: ResMut<TotalPoints>,
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
                //player1.set_total_points(2);
                //println!("Bones: {}", total_points.0);
                total_points.0 += 1;
                bone_tf.translation.x += 1000.0;
                bone_tf.translation.y = thread_rng().gen_range(-380.0..380.0);
            }
        }
    }
}

// Collision management
fn player_collide_with_hawk(
    mut total_points: ResMut<TotalPoints>,
    mut hawk_query: Query<(&Hawk, &mut Transform), Without<Player>>,
    mut player_query: Query<(&Player, &mut Transform), Without<Hawk>>) { 
	// iterate through the Bones
	for (_, mut hawk_tf) in hawk_query.iter_mut() {
        // Check if the bone collides
        for (player, mut player_tf) in player_query.iter_mut() {
            //println!("Player position: {}", player_tf.translation.y);     
            if collide(hawk_tf.translation, Vec2::new(60.0, 60.0),Vec3::new(player_tf.translation.x, player_tf.translation.y+50.0, player_tf.translation.z), Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT/2.0)).is_some() {
                //println!("Collision happened at: {} {}", bone_tf.translation.x, bone_tf.translation.y);
                //player.total_points += 1;
                //player1.set_total_points(2);
                //println!("Bones: {}", total_points.0);
                //total_points.0 -= 10;
                //player_tf.translation.y = thread_rng().gen_range(-380.0..380.0);
                player_tf.translation.y = -300.0;
            }
        }
    }
}

fn update_points(
    total_points: ResMut<TotalPoints>,
    mut query: Query<&mut Text, With<Points>>) {
    for mut text in query.iter_mut() {
        // Update the value of the first (only) section
        text.sections[0].value = format!("Bones: {}", total_points.0);
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
