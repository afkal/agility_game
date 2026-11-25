//! On-screen information: hearts, the gingerbread count and the finish screen.

use bevy::prelude::*;

use crate::art::{self, HEART_EMPTY, HEART_RED, HeartPiece, Painter};
use crate::collect::{CELEBRATION_MIN_TIME, CelebrationTime, GingerbreadCount};
use crate::hazards::{Hearts, STARTING_HEARTS};
use crate::rules::{GameState, WINDOW_HEIGHT, WINDOW_WIDTH};
use crate::visuals::MainCamera;

const FONT: &str = "fonts/FiraSans-Bold.ttf";
const HUD_Z: f32 = 50.0;

pub struct HudPlugin;

impl Plugin for HudPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_hud.after(crate::visuals::spawn_camera))
            .add_systems(Update, (update_hearts, update_count))
            .add_systems(OnEnter(GameState::Finished), spawn_finish_screen)
            .add_systems(OnExit(GameState::Finished), despawn_finish_screen)
            .add_systems(
                Update,
                (show_play_again_hint, animate_confetti).run_if(in_state(GameState::Finished)),
            );
    }
}

#[derive(Component)]
struct HeartIcon(u8);

#[derive(Component)]
struct CountText;

#[derive(Resource)]
struct HeartMaterials {
    full: Handle<ColorMaterial>,
    empty: Handle<ColorMaterial>,
}

#[derive(Component)]
struct FinishScreen;

#[derive(Component)]
struct PlayAgainHint;

#[derive(Component)]
struct Confetti {
    velocity: Vec2,
    spin: f32,
}

fn spawn_hud(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    camera: Query<Entity, With<MainCamera>>,
) {
    let Ok(camera) = camera.single() else { return };
    let mut painter = Painter {
        meshes: &mut meshes,
        materials: &mut materials,
    };
    let full = painter.material(HEART_RED);
    let empty = painter.material(HEART_EMPTY);
    let top = WINDOW_HEIGHT / 2.0 - 40.0;
    let left = -WINDOW_WIDTH / 2.0 + 45.0;
    let right = WINDOW_WIDTH / 2.0 - 45.0;

    commands.entity(camera).with_children(|hud| {
        for i in 0..STARTING_HEARTS {
            hud.spawn((
                HeartIcon(i),
                Transform::from_xyz(left + i as f32 * 52.0, top, HUD_Z),
                Visibility::default(),
            ))
            .with_children(|heart| art::heart(heart, &mut painter, 44.0, full.clone()));
        }
        hud.spawn((
            Transform::from_xyz(right - 150.0, top, HUD_Z),
            Visibility::default(),
        ))
        .with_children(|icon| art::gingerbread_man(icon, &mut painter, 44.0));
        hud.spawn((
            CountText,
            Text2d::new("0"),
            TextFont {
                font: asset_server.load(FONT).into(),
                font_size: FontSize::Px(36.0),
                ..default()
            },
            TextColor(Color::WHITE),
            Transform::from_xyz(right - 80.0, top, HUD_Z),
        ));
    });
    commands.insert_resource(HeartMaterials { full, empty });
}

fn update_hearts(
    hearts: Res<Hearts>,
    heart_materials: Option<Res<HeartMaterials>>,
    icons: Query<(&HeartIcon, &Children)>,
    mut pieces: Query<&mut MeshMaterial2d<ColorMaterial>, With<HeartPiece>>,
) {
    let Some(heart_materials) = heart_materials else {
        return;
    };
    if !hearts.is_changed() && !heart_materials.is_added() {
        return;
    }
    for (icon, children) in &icons {
        let material = if icon.0 < hearts.0 {
            heart_materials.full.clone()
        } else {
            heart_materials.empty.clone()
        };
        for child in children.iter() {
            if let Ok(mut piece) = pieces.get_mut(child) {
                piece.0 = material.clone();
            }
        }
    }
}

fn update_count(count: Res<GingerbreadCount>, mut texts: Query<&mut Text2d, With<CountText>>) {
    if !count.is_changed() {
        return;
    }
    for mut text in &mut texts {
        text.0 = count.0.to_string();
    }
}

fn spawn_finish_screen(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    count: Res<GingerbreadCount>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    camera: Query<Entity, With<MainCamera>>,
) {
    let font = asset_server.load(FONT);
    let cookies = if count.0 == 1 { "cookie" } else { "cookies" };
    commands
        .spawn((
            FinishScreen,
            Node {
                width: Val::Percent(100.0),
                height: Val::Percent(100.0),
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::Center,
                align_items: AlignItems::Center,
                ..default()
            },
        ))
        .with_children(|screen| {
            screen
                .spawn((
                    Node {
                        flex_direction: FlexDirection::Column,
                        align_items: AlignItems::Center,
                        row_gap: Val::Px(18.0),
                        padding: UiRect::axes(Val::Px(48.0), Val::Px(28.0)),
                        border_radius: BorderRadius::all(Val::Px(24.0)),
                        ..default()
                    },
                    BackgroundColor(Color::srgba(0.05, 0.16, 0.36, 0.6)),
                ))
                .with_children(|screen| {
                    screen.spawn((
                        Text::new("Well done!"),
                        TextFont {
                            font: font.clone().into(),
                            font_size: FontSize::Px(72.0),
                            ..default()
                        },
                        TextColor(Color::WHITE),
                    ));
                    screen.spawn((
                        Text::new(format!(
                            "The dog brought {} gingerbread {cookies}!",
                            count.0
                        )),
                        TextFont {
                            font: font.clone().into(),
                            font_size: FontSize::Px(40.0),
                            ..default()
                        },
                        TextColor(Color::WHITE),
                    ));
                    screen.spawn((
                        PlayAgainHint,
                        Text::new("Press Space to play again"),
                        TextFont {
                            font: font.into(),
                            font_size: FontSize::Px(28.0),
                            ..default()
                        },
                        TextColor(Color::WHITE),
                        Visibility::Hidden,
                    ));
                });
        });

    // Confetti in Christmas colours, falling across the view.
    let Ok(camera) = camera.single() else { return };
    let mut painter = Painter {
        meshes: &mut meshes,
        materials: &mut materials,
    };
    let colors = [art::CANDY_RED, art::GOLD, art::PINE_GREEN, art::SNOW_WHITE];
    commands.entity(camera).with_children(|parent| {
        for i in 0..120 {
            let x = rand::random_range(-WINDOW_WIDTH / 2.0..WINDOW_WIDTH / 2.0);
            let y = rand::random_range(WINDOW_HEIGHT / 2.0..WINDOW_HEIGHT * 1.2);
            parent.spawn((
                FinishScreen,
                Confetti {
                    velocity: Vec2::new(
                        rand::random_range(-40.0..40.0),
                        rand::random_range(-260.0..-140.0),
                    ),
                    spin: rand::random_range(-6.0..6.0),
                },
                painter.rect(
                    Vec2::new(10.0, 6.0),
                    colors[i % colors.len()],
                    Vec3::new(x, y, HUD_Z - 1.0),
                ),
            ));
        }
    });
}

fn show_play_again_hint(
    celebration: Res<CelebrationTime>,
    mut hints: Query<&mut Visibility, With<PlayAgainHint>>,
) {
    if celebration.0 >= CELEBRATION_MIN_TIME {
        for mut visibility in &mut hints {
            *visibility = Visibility::Visible;
        }
    }
}

fn animate_confetti(time: Res<Time>, mut confetti: Query<(&Confetti, &mut Transform)>) {
    let dt = time.delta_secs();
    for (piece, mut transform) in &mut confetti {
        transform.translation += (piece.velocity * dt).extend(0.0);
        transform.rotate_z(piece.spin * dt);
        if transform.translation.y < -WINDOW_HEIGHT / 2.0 - 20.0 {
            transform.translation.y += WINDOW_HEIGHT + 60.0;
        }
    }
}

fn despawn_finish_screen(mut commands: Commands, screens: Query<Entity, With<FinishScreen>>) {
    for entity in &screens {
        commands.entity(entity).despawn();
    }
}
