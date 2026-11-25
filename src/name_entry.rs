//! The welcome screen where the player types their dog's name before the run.

use bevy::input::{
    ButtonState,
    keyboard::{Key, KeyboardInput},
};
use bevy::prelude::*;

use crate::rules::GameState;

const FONT: &str = "fonts/FiraSans-Bold.ttf";
pub const MAX_NAME_LENGTH: usize = 16;

/// The dog's name as the player typed it. Empty until they type one.
#[derive(Resource, Debug, Default, Clone, PartialEq, Eq)]
pub struct DogName(pub String);

impl DogName {
    /// The name to show in sentences, falling back to "The dog".
    pub fn display(&self) -> &str {
        match self.0.trim() {
            "" => "The dog",
            name => name,
        }
    }
}

pub struct NameEntryPlugin;

impl Plugin for NameEntryPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<DogName>()
            .add_systems(OnEnter(GameState::NameEntry), spawn_name_screen)
            .add_systems(OnExit(GameState::NameEntry), despawn_name_screen)
            .add_systems(
                Update,
                (type_name, show_name)
                    .chain()
                    .run_if(in_state(GameState::NameEntry)),
            );
    }
}

#[derive(Debug, PartialEq, Eq)]
enum NameEdit {
    Changed,
    Confirmed,
    Ignored,
}

/// Apply one key press to the name being typed.
fn edit_name(name: &mut String, key: &Key, text: Option<&str>) -> NameEdit {
    match key {
        Key::Enter => NameEdit::Confirmed,
        Key::Backspace => {
            if name.pop().is_some() {
                NameEdit::Changed
            } else {
                NameEdit::Ignored
            }
        }
        _ => {
            let Some(text) = text else {
                return NameEdit::Ignored;
            };
            let mut changed = false;
            for c in text.chars().filter(|c| !c.is_control()) {
                if name.chars().count() >= MAX_NAME_LENGTH || (c == ' ' && name.is_empty()) {
                    continue;
                }
                name.push(c);
                changed = true;
            }
            if changed {
                NameEdit::Changed
            } else {
                NameEdit::Ignored
            }
        }
    }
}

fn type_name(
    mut keys: MessageReader<KeyboardInput>,
    mut name: ResMut<DogName>,
    mut next_state: ResMut<NextState<GameState>>,
) {
    for key in keys.read() {
        if key.state != ButtonState::Pressed {
            continue;
        }
        let edit = edit_name(&mut name.0, &key.logical_key, key.text.as_deref());
        if edit == NameEdit::Confirmed {
            let trimmed = name.0.trim().to_string();
            name.0 = trimmed;
            next_state.set(GameState::Playing);
            return;
        }
    }
}

#[derive(Component)]
struct NameScreen;

#[derive(Component)]
struct NameText;

fn spawn_name_screen(mut commands: Commands, asset_server: Res<AssetServer>) {
    let font = asset_server.load(FONT);
    let label = |text: &str, size: f32| {
        (
            Text::new(text),
            TextFont {
                font: font.clone().into(),
                font_size: FontSize::Px(size),
                ..default()
            },
            TextColor(Color::WHITE),
        )
    };
    commands
        .spawn((
            NameScreen,
            Node {
                width: Val::Percent(100.0),
                height: Val::Percent(100.0),
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
                .with_children(|panel| {
                    panel.spawn(label("Welcome to Agility Camp!", 56.0));
                    panel.spawn(label("What is your dog's name?", 32.0));
                    panel
                        .spawn((
                            Node {
                                min_width: Val::Px(360.0),
                                padding: UiRect::axes(Val::Px(20.0), Val::Px(8.0)),
                                justify_content: JustifyContent::Center,
                                border_radius: BorderRadius::all(Val::Px(12.0)),
                                ..default()
                            },
                            BackgroundColor(Color::srgba(1.0, 1.0, 1.0, 0.9)),
                        ))
                        .with_children(|field| {
                            field.spawn((
                                NameText,
                                Text::new("_"),
                                TextFont {
                                    font: font.clone().into(),
                                    font_size: FontSize::Px(40.0),
                                    ..default()
                                },
                                TextColor(Color::srgb(0.10, 0.20, 0.40)),
                            ));
                        });
                    panel.spawn(label("Press Enter to start", 26.0));
                });
        });
}

fn show_name(name: Res<DogName>, mut texts: Query<&mut Text, With<NameText>>) {
    if !name.is_changed() {
        return;
    }
    for mut text in &mut texts {
        text.0 = format!("{}_", name.0);
    }
}

fn despawn_name_screen(mut commands: Commands, screens: Query<Entity, With<NameScreen>>) {
    for entity in &screens {
        commands.entity(entity).despawn();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn type_text(name: &mut String, text: &str) {
        for c in text.chars() {
            let s = c.to_string();
            edit_name(name, &Key::Character(s.as_str().into()), Some(&s));
        }
    }

    #[test]
    fn typing_builds_the_name_and_backspace_removes_a_letter() {
        let mut name = String::new();
        type_text(&mut name, "Elmoo");
        assert_eq!(name, "Elmoo");
        assert_eq!(
            edit_name(&mut name, &Key::Backspace, None),
            NameEdit::Changed
        );
        assert_eq!(name, "Elmo");
    }

    #[test]
    fn enter_confirms_the_name() {
        let mut name = "Elmo".to_string();
        assert_eq!(edit_name(&mut name, &Key::Enter, None), NameEdit::Confirmed);
        assert_eq!(name, "Elmo");
    }

    #[test]
    fn name_is_capped_and_cannot_start_with_a_space() {
        let mut name = String::new();
        type_text(&mut name, " A very long dog name indeed");
        assert_eq!(name.chars().count(), MAX_NAME_LENGTH);
        assert!(name.starts_with('A'));
    }

    #[test]
    fn keys_without_text_are_ignored() {
        let mut name = "Elmo".to_string();
        assert_eq!(edit_name(&mut name, &Key::Shift, None), NameEdit::Ignored);
        assert_eq!(
            edit_name(&mut name, &Key::Character("\u{7f}".into()), Some("\u{7f}")),
            NameEdit::Ignored
        );
        assert_eq!(name, "Elmo");
    }

    #[test]
    fn empty_name_shows_as_the_dog() {
        assert_eq!(DogName(String::new()).display(), "The dog");
        assert_eq!(DogName("  ".into()).display(), "The dog");
        assert_eq!(DogName("Elmo".into()).display(), "Elmo");
    }
}
