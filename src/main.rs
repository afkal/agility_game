use bevy::{prelude::*, window::WindowResolution};

// Start: --- Resources
#[derive(Resource)]
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
const WINDOW_WIDTH: u32 = 1280;
const WINDOW_HEIGHT: u32 = 800;
const PLAYER_WIDTH: f32 = 120.0;
const PLAYER_HEIGHT: f32 = 200.0;
const BONE_WIDTH: f32 = 30.0;
const BONE_HEIGHT: f32 = 15.0;

const BACKGROUND_COLOR: Color = Color::srgb(0.3, 0.7, 1.0); // sky blue
const GROUND_COLOR: Color = Color::srgb(0.48, 98.8, 0.75); // light green

pub struct GamePlugin;

impl Plugin for GamePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Startup,
            (
                setup_game,
                spawn_player,
                spawn_grass,
                spawn_cloud,
                spawn_points,
                bone_spawner,
            ),
        )
        .add_systems(
            Update,
            (
                player_movement,
                //back_and_forth_movement,
                bone_mover,
                hawk_mover,
                float_right,
                player_collide_with_bone,
                player_collide_with_hawk,
                update_points,
                hawk_spawner,
                exit_on_esc,
            ),
        );
    }
}

fn setup_game(mut commands: Commands) {
    commands.spawn(Camera2d); // one camera renders both sprites and UI
    commands.insert_resource(TotalPoints(0));
}

fn exit_on_esc(keyboard_input: Res<ButtonInput<KeyCode>>, mut exit: MessageWriter<AppExit>) {
    if keyboard_input.just_pressed(KeyCode::Escape) {
        exit.write(AppExit::Success);
    }
}

//// PLAYER
fn spawn_player(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn((
        Sprite {
            image: asset_server.load("sprites/dog-with-balloons-white.png"),
            custom_size: Some(Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT)),
            ..default()
        },
        Transform::from_xyz(-400., 0., 10.),
        //BackAndForth,
        Player,
    ));
}

// System currently not in use!!!
fn up_and_down_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut positions: Query<&mut Transform, With<UpAndDown>>,
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

// System currently not in use!!!
fn back_and_forth_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut positions: Query<&mut Transform, With<BackAndForth>>,
) {
    for mut transform in positions.iter_mut() {
        /*
        if keyboard_input.pressed(KeyCode::ArrowLeft) {
            transform.translation.x -= 3.;
            continue;
        }
        */
        if keyboard_input.pressed(KeyCode::ArrowRight) {
            transform.translation.x += 3.;
            continue;
        }
        transform.translation.x -= 1.5;
    }
}

fn player_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
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
    commands.spawn((
        Text::new("Bones: 0"),
        TextFont {
            font: asset_server.load("fonts/FiraSans-Bold.ttf").into(),
            font_size: FontSize::Px(30.0),
            ..default()
        },
        TextColor(Color::WHITE),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(5.0),
            right: Val::Px(15.0),
            ..default()
        },
        Points,
    ));
}

/// GRASS
fn spawn_grass(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn((
        Sprite {
            image: asset_server.load("sprites/grass.png"),
            custom_size: Some(Vec2::new(1280.0, 70.0)),
            ..default()
        },
        Transform::from_xyz(-0., -365., 20.),
    ));
}

/// Cloud
fn spawn_cloud(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn((
        Sprite {
            image: asset_server.load("sprites/cloud.png"),
            custom_size: Some(Vec2::new(400.0, 200.0)),
            ..default()
        },
        Transform::from_xyz(800., 300., 0.),
        Floater(0.2),
    ));
}

/// Hawk
fn spawn_hawk(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn((
        Sprite {
            image: asset_server.load("sprites/hawk.png"),
            custom_size: Some(Vec2::new(60.0, 60.0)),
            ..default()
        },
        Transform::from_xyz(800., rand::random_range(-200.0..400.0), 1.),
        Hawk(rand::random_range(2.5..4.5)),
    ));
}

fn hawk_spawner(commands: Commands, asset_server: Res<AssetServer>) {
    let randomizer: f32 = rand::random_range(0.0..1000.0);
    if randomizer > 999.0 {
        spawn_hawk(commands, asset_server);
    }
}

//// BONE
fn bone_spawner(mut commands: Commands, asset_server: Res<AssetServer>) {
    for _ in 1..10 {
        commands.spawn((
            Sprite {
                image: asset_server.load("sprites/bone-yellow.png"),
                custom_size: Some(Vec2::new(BONE_WIDTH, BONE_HEIGHT)),
                ..default()
            },
            Transform {
                translation: Vec3::new(
                    rand::random_range(-500.0..500.0),
                    rand::random_range(-350.0..350.0),
                    0.0,
                ),
                rotation: Quat::from_rotation_z(rand::random_range(0.0..3.14)),
                scale: Vec3::new(1.0, 1.0, 1.0),
            },
            Bone,
        ));
    }
}

fn bone_mover(mut positions: Query<&mut Transform, With<Bone>>) {
    for mut transform in positions.iter_mut() {
        // X-AXIS
        transform.translation.x -= 2.;

        // ROTATION
        let rotation_delta = Quat::from_rotation_z(6.28 * 1.0 / 60.0);
        transform.rotation *= rotation_delta;
        // Rewind back to right incase object moves out of sight
        if transform.translation.x < -650.0 {
            transform.translation.x += 1280.0;
            transform.translation.y = rand::random_range(-350.0..350.0);
        }
    }
}

fn float_right(mut positions: Query<(&mut Transform, &Floater)>) {
    for (mut transform, speed) in positions.iter_mut() {
        transform.translation.x -= speed.0;
        if transform.translation.x < -800.0 {
            transform.translation.x += 1600.0;
        }
    }
}

fn hawk_mover(mut positions: Query<(&mut Transform, &Hawk)>) {
    for (mut transform, speed) in positions.iter_mut() {
        transform.translation.x -= speed.0;
        if transform.translation.x < -800.0 {
            transform.translation.x += 1600.0;
            transform.translation.y = rand::random_range(-300.0..350.0);
        }
    }
}

/// Axis-aligned bounding box from a center point and full width/height
/// (same semantics as the old `collide_aabb::collide` sizes).
fn aabb(center: Vec2, size: Vec2) -> Aabb2d {
    Aabb2d::new(center, size / 2.0)
}

// Collision management
fn player_collide_with_bone(
    mut total_points: ResMut<TotalPoints>,
    mut bone_query: Query<&mut Transform, (With<Bone>, Without<Player>)>,
    player_query: Query<&Transform, (With<Player>, Without<Bone>)>,
) {
    // iterate through the Bones
    for mut bone_tf in bone_query.iter_mut() {
        // Check if the bone collides
        for player_tf in player_query.iter() {
            let bone_box = aabb(bone_tf.translation.truncate(), Vec2::new(BONE_WIDTH, BONE_HEIGHT));
            let player_box = aabb(
                player_tf.translation.truncate() - Vec2::new(0.0, 50.0),
                Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT / 2.0),
            );
            if bone_box.intersects(&player_box) {
                total_points.0 += 1;
                bone_tf.translation.x += 1000.0;
                bone_tf.translation.y = rand::random_range(-380.0..380.0);
            }
        }
    }
}

// Collision management
fn player_collide_with_hawk(
    hawk_query: Query<&Transform, (With<Hawk>, Without<Player>)>,
    mut player_query: Query<&mut Transform, (With<Player>, Without<Hawk>)>,
) {
    // iterate through the Hawks
    for hawk_tf in hawk_query.iter() {
        // Check if the hawk collides
        for mut player_tf in player_query.iter_mut() {
            let hawk_box = aabb(hawk_tf.translation.truncate(), Vec2::new(60.0, 60.0));
            let player_box = aabb(
                player_tf.translation.truncate() + Vec2::new(0.0, 50.0),
                Vec2::new(PLAYER_WIDTH, PLAYER_HEIGHT / 2.0),
            );
            if hawk_box.intersects(&player_box) {
                player_tf.translation.y = -300.0;
            }
        }
    }
}

fn update_points(total_points: Res<TotalPoints>, mut query: Query<&mut Text, With<Points>>) {
    for mut text in query.iter_mut() {
        text.0 = format!("Bones: {}", total_points.0);
    }
}

fn main() {
    App::new()
        .insert_resource(ClearColor(BACKGROUND_COLOR))
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Agility Camp".to_string(),
                resolution: WindowResolution::new(WINDOW_WIDTH, WINDOW_HEIGHT),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(GamePlugin)
        .run();
}
