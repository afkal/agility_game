//! Presentation: camera, background, and the pictures drawn for each rule
//! entity. Nothing here changes what happens in the game.

use std::f32::consts::FRAC_PI_2;

use bevy::prelude::*;

use crate::art::{self, ArtCache, Painter};
use crate::course::{Cookie, CourseLayout, CoursePart, FinishLine, GROUND_BOTTOM, GROUND_TOP};
use crate::hazards::Snowball;
use crate::hud::HudPlugin;
use crate::player::Dog;
use crate::rules::{ScrollPosition, WINDOW_HEIGHT, WINDOW_WIDTH};
use crate::snow::SnowPlugin;

/// Medium winter-sky blue. The black dog silhouette reads clearly against it,
/// and white snowflakes stay visible.
const SKY_COLOR: Color = Color::srgb(0.45, 0.68, 0.92);
const ICE: Color = Color::srgb(0.62, 0.86, 0.95);
const DEEP_WATER: Color = Color::srgb(0.24, 0.47, 0.70);
const RIBBON: Color = Color::srgb(0.98, 0.80, 0.22);
const DOG_IMAGE: &str = "sprites/standing-right.png";
/// The dog picture is square; the dog's feet sit about a quarter of the way up.
const DOG_PICTURE_SIZE: f32 = 150.0;

pub struct VisualsPlugin;

impl Plugin for VisualsPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins((HudPlugin, SnowPlugin))
            .init_resource::<ArtCache>()
            .insert_resource(ClearColor(SKY_COLOR))
            .add_systems(
                Startup,
                (
                    spawn_camera,
                    spawn_backdrop.after(spawn_camera),
                    spawn_ponds,
                ),
            )
            .add_systems(
                Update,
                (
                    draw_parts,
                    draw_cookies,
                    bob_cookies,
                    draw_snowballs,
                    draw_finish,
                    draw_dog,
                    tilt_dog,
                ),
            )
            .add_systems(
                PostUpdate,
                (follow_scroll, move_backdrop).before(TransformSystems::Propagate),
            );
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

/// A background layer that scrolls slower than the course and wraps around.
#[derive(Component)]
struct Backdrop {
    base_x: f32,
    /// 0 stays still on screen, 1 moves with the course.
    depth: f32,
    span: f32,
}

fn spawn_backdrop(
    mut commands: Commands,
    mut painter: Painter,
    camera: Query<Entity, With<MainCamera>>,
) {
    let Ok(camera) = camera.single() else { return };
    let far_hill = Color::srgb(0.84, 0.91, 0.98);
    let near_hill = Color::srgb(0.91, 0.95, 1.0);
    let span = WINDOW_WIDTH * 2.0;
    commands.entity(camera).with_children(|parent| {
        // Far hills.
        for i in 0..6 {
            let base_x = i as f32 * span / 6.0;
            parent
                .spawn((
                    Backdrop {
                        base_x,
                        depth: 0.15,
                        span,
                    },
                    Transform::default(),
                    Visibility::default(),
                ))
                .with_children(|hill| {
                    hill.spawn(painter.shape(
                        Ellipse::new(320.0, 170.0),
                        far_hill,
                        Vec3::new(0.0, -260.0, -900.0),
                        0.0,
                    ));
                });
        }
        // Nearer hills with pine trees.
        for i in 0..5 {
            let base_x = i as f32 * span / 5.0 + 120.0;
            parent
                .spawn((
                    Backdrop {
                        base_x,
                        depth: 0.35,
                        span,
                    },
                    Transform::default(),
                    Visibility::default(),
                ))
                .with_children(|hill| {
                    hill.spawn(painter.shape(
                        Ellipse::new(260.0, 120.0),
                        near_hill,
                        Vec3::new(0.0, -290.0, -800.0),
                        0.0,
                    ));
                    for (dx, h) in [(-90.0, 90.0), (-30.0, 120.0), (60.0, 100.0)] {
                        pine(hill, &mut painter, Vec3::new(dx, -220.0, -790.0), h);
                    }
                });
        }
    });
}

fn pine(parent: &mut ChildSpawnerCommands, painter: &mut Painter, base: Vec3, height: f32) {
    let w = height * 0.45;
    parent.spawn(painter.rect(
        Vec2::new(w * 0.18, height * 0.2),
        Color::srgb(0.42, 0.27, 0.16),
        base + Vec3::new(0.0, height * 0.1, -0.1),
    ));
    for (i, scale) in [1.0, 0.78, 0.55].iter().enumerate() {
        let y0 = base.y + height * (0.15 + i as f32 * 0.22);
        let half = w * scale;
        parent.spawn(painter.triangle(
            Vec2::new(base.x - half, y0),
            Vec2::new(base.x + half, y0),
            Vec2::new(base.x, y0 + height * 0.42),
            art::DARK_PINE,
            base.z + i as f32 * 0.01,
        ));
        // A little snow on each tier.
        parent.spawn(painter.triangle(
            Vec2::new(base.x - half * 0.35, y0 + height * 0.28),
            Vec2::new(base.x + half * 0.35, y0 + height * 0.28),
            Vec2::new(base.x, y0 + height * 0.42),
            art::SNOW_WHITE,
            base.z + i as f32 * 0.01 + 0.005,
        ));
    }
}

fn move_backdrop(scroll: Res<ScrollPosition>, mut layers: Query<(&Backdrop, &mut Transform)>) {
    for (layer, mut transform) in &mut layers {
        let x = (layer.base_x - scroll.0 * layer.depth).rem_euclid(layer.span);
        transform.translation.x = x - layer.span / 2.0;
    }
}

/// Icy water at the bottom of each gap.
fn spawn_ponds(mut commands: Commands, layout: Res<CourseLayout>, mut painter: Painter) {
    for (x0, x1) in layout.gaps() {
        let width = x1 - x0;
        let center = (x0 + x1) / 2.0;
        commands.spawn(painter.rect(
            Vec2::new(width, WINDOW_HEIGHT / 2.0 + GROUND_TOP - 40.0 + 200.0),
            DEEP_WATER,
            Vec3::new(center, GROUND_BOTTOM - 40.0, 0.5),
        ));
        commands.spawn(painter.rect(
            Vec2::new(width, 14.0),
            ICE,
            Vec3::new(center, GROUND_TOP - 60.0, 0.6),
        ));
    }
}

fn draw_parts(
    mut commands: Commands,
    mut painter: Painter,
    parts: Query<(Entity, &CoursePart), Added<CoursePart>>,
) {
    for (entity, part) in &parts {
        commands
            .entity(entity)
            .insert(Visibility::default())
            .with_children(|parent| match part {
                CoursePart::Ground(b) => {
                    let size = b.max - b.min;
                    let center = (b.min + b.max) / 2.0;
                    parent.spawn(painter.rect(size, art::SNOW_WHITE, center.extend(1.0)));
                    parent.spawn(painter.rect(
                        Vec2::new(size.x, size.y * 0.55),
                        art::SNOW_SHADE,
                        Vec3::new(center.x, b.min.y + size.y * 0.275, 1.1),
                    ));
                }
                CoursePart::Hurdle(b) => {
                    // A candy-cane post with a gold knob and a green bow.
                    let size = b.max - b.min;
                    let stripes = 6;
                    let h = size.y / stripes as f32;
                    for i in 0..stripes {
                        let color = art::candy_stripe(i);
                        parent.spawn(painter.rect(
                            Vec2::new(size.x, h),
                            color,
                            Vec3::new(b.min.x + size.x / 2.0, b.min.y + h * (i as f32 + 0.5), 3.0),
                        ));
                    }
                    let top = Vec3::new(b.min.x + size.x / 2.0, b.max.y + 6.0, 3.1);
                    parent.spawn(painter.circle(8.0, art::GOLD, top));
                    for dx in [-9.0, 9.0] {
                        parent.spawn(painter.shape(
                            Ellipse::new(8.0, 5.0),
                            art::PINE_GREEN,
                            Vec3::new(top.x + dx, b.max.y - 8.0, 3.2),
                            0.0,
                        ));
                    }
                }
                CoursePart::Table(b) => {
                    // Agility tables are giant Christmas presents with snow on top.
                    let size = b.max - b.min;
                    let center = (b.min + b.max) / 2.0;
                    parent.spawn(painter.rect(size, art::CANDY_RED, center.extend(2.0)));
                    parent.spawn(painter.rect(Vec2::new(18.0, size.y), RIBBON, center.extend(2.1)));
                    parent.spawn(painter.rect(
                        Vec2::new(size.x, 14.0),
                        RIBBON,
                        Vec3::new(center.x, b.max.y - 22.0, 2.1),
                    ));
                    parent.spawn(painter.rect(
                        Vec2::new(size.x + 8.0, 10.0),
                        art::SNOW_WHITE,
                        Vec3::new(center.x, b.max.y - 3.0, 2.2),
                    ));
                    for dx in [-16.0, 16.0] {
                        parent.spawn(painter.shape(
                            Ellipse::new(16.0, 9.0),
                            RIBBON,
                            Vec3::new(center.x + dx, b.max.y + 7.0, 2.3),
                            dx.signum() * 0.4,
                        ));
                    }
                }
                CoursePart::AFrame(a) => {
                    // Candy-striped chevrons.
                    let left = Vec2::new(a.x0, GROUND_TOP);
                    let right = Vec2::new(a.x0 + 2.0 * a.half_width, GROUND_TOP);
                    let apex = a.apex();
                    let colors = [
                        art::CANDY_RED,
                        art::SNOW_WHITE,
                        art::CANDY_RED,
                        art::SNOW_WHITE,
                    ];
                    for (i, color) in colors.iter().enumerate() {
                        let t = i as f32 * 0.22;
                        let drop = Vec2::new(0.0, -a.height * t * 0.9);
                        let shrink = (right - left) * t * 0.5;
                        parent.spawn(painter.triangle(
                            left + shrink,
                            right - shrink,
                            apex + drop,
                            *color,
                            2.0 + i as f32 * 0.01,
                        ));
                    }
                    parent.spawn(painter.circle(
                        10.0,
                        art::GOLD,
                        apex.extend(2.1) + Vec3::new(0.0, 4.0, 0.0),
                    ));
                }
            });
    }
}

#[derive(Component)]
struct CookieBob {
    phase: f32,
}

fn draw_cookies(
    mut commands: Commands,
    mut painter: Painter,
    cookies: Query<(Entity, &Cookie, &Transform), Added<Cookie>>,
) {
    for (entity, cookie, transform) in &cookies {
        let phase = transform.translation.x * 0.01;
        commands
            .entity(entity)
            .insert(Visibility::default())
            .with_children(|parent| {
                parent
                    .spawn((
                        CookieBob { phase },
                        Transform::default(),
                        Visibility::default(),
                    ))
                    .with_children(|man| {
                        art::gingerbread_man(man, &mut painter, cookie.radius * 2.4)
                    });
            });
    }
}

/// Cookies float gently up and down; only the picture moves, not the cookie.
fn bob_cookies(time: Res<Time>, mut bobs: Query<(&CookieBob, &mut Transform)>) {
    let t = time.elapsed_secs();
    for (bob, mut transform) in &mut bobs {
        transform.translation.y = (t * 2.5 + bob.phase).sin() * 4.0;
    }
}

fn draw_snowballs(
    mut commands: Commands,
    mut painter: Painter,
    snowballs: Query<(Entity, &Snowball), Added<Snowball>>,
) {
    for (entity, ball) in &snowballs {
        commands
            .entity(entity)
            .insert(Visibility::default())
            .with_children(|parent| {
                parent.spawn(painter.circle(ball.radius, art::SNOW_SHADE, Vec3::ZERO));
                parent.spawn(painter.circle(
                    ball.radius * 0.85,
                    art::SNOW_WHITE,
                    Vec3::new(-2.0, 2.0, 0.1),
                ));
                // A couple of marks so the rolling shows.
                parent.spawn(painter.circle(
                    3.0,
                    art::SNOW_SHADE,
                    Vec3::new(ball.radius * 0.45, 0.0, 0.2),
                ));
                parent.spawn(painter.circle(
                    2.5,
                    art::SNOW_SHADE,
                    Vec3::new(-ball.radius * 0.3, -ball.radius * 0.4, 0.2),
                ));
            });
    }
}

fn draw_finish(
    mut commands: Commands,
    mut painter: Painter,
    finish: Query<Entity, Added<FinishLine>>,
) {
    for entity in &finish {
        commands
            .entity(entity)
            .insert(Visibility::default())
            .with_children(|parent| {
                // Candy-cane gate posts and a gold banner.
                for dx in [-110.0, 110.0] {
                    for i in 0..10 {
                        let color = art::candy_stripe(i);
                        parent.spawn(painter.rect(
                            Vec2::new(14.0, 22.0),
                            color,
                            Vec3::new(dx, 11.0 + i as f32 * 22.0, 0.0),
                        ));
                    }
                }
                parent.spawn(painter.rect(
                    Vec2::new(240.0, 34.0),
                    art::GOLD,
                    Vec3::new(0.0, 225.0, 0.1),
                ));
                parent.spawn(painter.rect(
                    Vec2::new(228.0, 22.0),
                    art::CANDY_RED,
                    Vec3::new(0.0, 225.0, 0.2),
                ));
                // A big Christmas tree behind the line, with presents.
                pine(parent, &mut painter, Vec3::new(330.0, 0.0, -0.5), 320.0);
                parent.spawn(painter.shape(
                    RegularPolygon::new(18.0, 5),
                    art::GOLD,
                    Vec3::new(330.0, 330.0, -0.3),
                    FRAC_PI_2 / 5.0,
                ));
                for (dx, w, h, color) in [
                    (260.0, 50.0, 40.0, art::CANDY_RED),
                    (400.0, 60.0, 50.0, art::PINE_GREEN),
                    (330.0, 40.0, 30.0, art::GOLD),
                ] {
                    parent.spawn(painter.rect(
                        Vec2::new(w, h),
                        color,
                        Vec3::new(dx, h / 2.0, -0.2),
                    ));
                    parent.spawn(painter.rect(
                        Vec2::new(8.0, h),
                        art::SNOW_WHITE,
                        Vec3::new(dx, h / 2.0, -0.19),
                    ));
                }
            });
    }
}

/// The dog's picture, tilted smoothly to follow the slope it stands on.
#[derive(Component)]
struct DogPicture {
    angle: f32,
}

/// How quickly the picture turns towards the slope angle, per second.
const TILT_RATE: f32 = 12.0;

fn tilt_dog(
    time: Res<Time>,
    dogs: Query<(&Dog, &Children)>,
    mut pictures: Query<(&mut DogPicture, &mut Transform)>,
) {
    let blend = (time.delta_secs() * TILT_RATE).min(1.0);
    for (dog, children) in &dogs {
        // Level out in the air; follow the ground otherwise.
        let target = dog.ground_angle.unwrap_or(0.0);
        for child in children.iter() {
            if let Ok((mut picture, mut transform)) = pictures.get_mut(child) {
                picture.angle += (target - picture.angle) * blend;
                transform.rotation = Quat::from_rotation_z(picture.angle);
            }
        }
    }
}

fn draw_dog(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut painter: Painter,
    dogs: Query<Entity, Added<Dog>>,
) {
    for entity in &dogs {
        commands
            .entity(entity)
            .insert(Visibility::default())
            .with_children(|parent| {
                parent
                    .spawn((
                        Sprite {
                            image: asset_server.load(DOG_IMAGE),
                            custom_size: Some(Vec2::splat(DOG_PICTURE_SIZE)),
                            ..default()
                        },
                        Transform::from_xyz(0.0, 2.0, 0.0),
                        DogPicture { angle: 0.0 },
                    ))
                    .with_children(|picture| santa_hat(picture, &mut painter));
            });
    }
}

/// A Santa hat sitting on the dog's head, leaning back. It is sized to the
/// head in the silhouette, which is narrow, so the brim does not reach past
/// the dog's nose.
fn santa_hat(parent: &mut ChildSpawnerCommands, painter: &mut Painter) {
    let brim = Vec2::new(31.0, 32.0);
    parent.spawn(painter.triangle(
        brim + Vec2::new(-10.0, 0.0),
        brim + Vec2::new(10.0, 1.0),
        brim + Vec2::new(-15.0, 21.0),
        art::CANDY_RED,
        0.2,
    ));
    parent.spawn(painter.shape(
        Capsule2d::new(3.5, 16.0),
        art::SNOW_WHITE,
        brim.extend(0.3),
        FRAC_PI_2 - 0.05,
    ));
    parent.spawn(painter.circle(
        4.5,
        art::SNOW_WHITE,
        (brim + Vec2::new(-16.0, 21.0)).extend(0.3),
    ));
}
