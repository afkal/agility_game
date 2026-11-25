//! Gingerbread cookies, the finish line and playing again.

use bevy::prelude::*;

use crate::course::{Cookie, FinishLine, RestartRequested};
use crate::physics::Aabb;
use crate::player::Dog;
use crate::rules::GameState;

/// The finish screen accepts "play again" only after the celebration has been
/// visible this long, so a jump pressed while crossing the line cannot skip it.
pub const CELEBRATION_MIN_TIME: f32 = 1.0;

#[derive(Resource, Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct GingerbreadCount(pub u32);

/// Seconds since the finish screen appeared.
#[derive(Resource, Debug, Default, Clone, Copy, PartialEq)]
pub struct CelebrationTime(pub f32);

pub fn reset_collecting(commands: &mut Commands) {
    commands.insert_resource(GingerbreadCount::default());
    commands.insert_resource(CelebrationTime::default());
}

pub fn collect_cookies(
    mut commands: Commands,
    mut count: ResMut<GingerbreadCount>,
    dogs: Query<&Dog>,
    cookies: Query<(Entity, &Cookie, &Transform)>,
) {
    let Ok(dog) = dogs.single() else { return };
    let dog_box = dog.body.aabb();
    for (entity, cookie, transform) in &cookies {
        let cookie_box = Aabb::from_center(transform.translation.truncate(), Vec2::splat(cookie.radius));
        if cookie_box.overlaps(&dog_box) {
            commands.entity(entity).despawn();
            count.0 += 1;
        }
    }
}

pub fn check_finish(
    mut dogs: Query<&mut Dog>,
    finish: Query<&FinishLine>,
    mut celebration: ResMut<CelebrationTime>,
    mut next_state: ResMut<NextState<GameState>>,
) {
    let (Ok(mut dog), Ok(finish)) = (dogs.single_mut(), finish.single()) else {
        return;
    };
    if dog.body.center.x >= finish.x {
        dog.jump_buffer = 0.0;
        celebration.0 = 0.0;
        next_state.set(GameState::Finished);
    }
}

pub fn play_again(
    time: Res<Time>,
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut celebration: ResMut<CelebrationTime>,
    mut restart: ResMut<RestartRequested>,
) {
    let ready = celebration.0 >= CELEBRATION_MIN_TIME;
    celebration.0 += time.delta_secs();
    if ready && keyboard_input.any_just_pressed([KeyCode::Space, KeyCode::Enter]) {
        restart.0 = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course::{CourseLayout, COOKIE_RADIUS, GROUND_TOP};
    use crate::hazards::Hearts;
    use crate::player::DOG_HALF_SIZE;
    use crate::rules::{test_support::*, ScrollPosition};

    fn count(app: &App) -> u32 {
        app.world().resource::<GingerbreadCount>().0
    }

    fn state(app: &App) -> GameState {
        *app.world().resource::<State<GameState>>().get()
    }

    fn cookie_count(app: &mut App) -> usize {
        app.world_mut().query::<&Cookie>().iter(app.world()).count()
    }

    fn dog_x(app: &mut App) -> f32 {
        app.world_mut().query::<&Dog>().single(app.world()).unwrap().body.center.x
    }

    /// Run until the dog crosses the finish line.
    fn run_to_finish(app: &mut App) {
        let mut t = 0.0;
        while state(app) != GameState::Finished {
            assert!(t < 30.0, "never reached the finish");
            step(app, 1.0 / 60.0);
            t += 1.0 / 60.0;
        }
    }

    fn at_dog_height(x: f32) -> Vec2 {
        Vec2::new(x, GROUND_TOP + DOG_HALF_SIZE.y)
    }

    #[test]
    fn running_into_a_cookie_collects_it_once() {
        let mut app = rules_app_with(CourseLayout {
            cookies: vec![at_dog_height(300.0)],
            ..CourseLayout::flat(50_000.0)
        });
        assert_eq!(count(&app), 0);
        run_for(&mut app, 2.0);
        assert_eq!(count(&app), 1);
        assert_eq!(cookie_count(&mut app), 0);
        run_for(&mut app, 1.0);
        assert_eq!(count(&app), 1);
    }

    #[test]
    fn cookie_high_above_is_not_collected_without_a_jump() {
        let mut app = rules_app_with(CourseLayout {
            cookies: vec![Vec2::new(300.0, GROUND_TOP + 2.0 * DOG_HALF_SIZE.y + COOKIE_RADIUS + 10.0)],
            ..CourseLayout::flat(50_000.0)
        });
        run_for(&mut app, 3.0);
        assert_eq!(count(&app), 0);
    }

    #[test]
    fn crossing_the_finish_shows_the_count_and_stops_the_run() {
        let cookies = (0..23).map(|i| at_dog_height(200.0 + i as f32 * 40.0)).collect();
        let mut app = rules_app_with(CourseLayout {
            cookies,
            finish_x: 1_500.0,
            ..CourseLayout::flat(50_000.0)
        });
        run_to_finish(&mut app);
        step(&mut app, 1.0 / 60.0);
        assert_eq!(state(&app), GameState::Finished);
        assert_eq!(count(&app), 23);
        let scroll = app.world().resource::<ScrollPosition>().0;
        let x = dog_x(&mut app);
        run_for(&mut app, 1.0);
        assert_eq!(app.world().resource::<ScrollPosition>().0, scroll);
        assert_eq!(dog_x(&mut app), x);
    }

    #[test]
    fn play_again_after_celebration_resets_the_run() {
        let mut app = rules_app_with(CourseLayout {
            cookies: vec![at_dog_height(300.0)],
            finish_x: 800.0,
            ..CourseLayout::flat(50_000.0)
        });
        app.world_mut().resource_mut::<Hearts>().0 = 2;
        run_to_finish(&mut app);
        run_for(&mut app, CELEBRATION_MIN_TIME + 0.1);
        press(&mut app, KeyCode::Space);
        step(&mut app, 1.0 / 60.0);
        release_all(&mut app);
        step(&mut app, 1.0 / 60.0);
        assert_eq!(state(&app), GameState::Playing);
        assert_eq!(count(&app), 0);
        assert_eq!(app.world().resource::<Hearts>().0, 3);
        assert!(dog_x(&mut app) < 50.0);
    }

    #[test]
    fn space_at_the_finish_line_does_not_skip_the_celebration() {
        let mut app = rules_app_with(CourseLayout {
            finish_x: 800.0,
            ..CourseLayout::flat(50_000.0)
        });
        run_to_finish(&mut app);
        press(&mut app, KeyCode::Space);
        step(&mut app, 1.0 / 60.0);
        release_all(&mut app);
        run_for(&mut app, 0.5);
        press(&mut app, KeyCode::Enter);
        step(&mut app, 1.0 / 60.0);
        release_all(&mut app);
        step(&mut app, 1.0 / 60.0);
        assert_eq!(state(&app), GameState::Finished);
    }

    #[test]
    fn losing_a_heart_keeps_collected_cookies() {
        let mut app = rules_app_with(CourseLayout {
            ground: vec![(-1_000.0, 600.0), (720.0, 50_000.0)],
            checkpoints: vec![100.0, 300.0],
            cookies: vec![at_dog_height(150.0), at_dog_height(250.0), at_dog_height(400.0)],
            start_x: 0.0,
            finish_x: 40_000.0,
            ..default()
        });
        while app.world().resource::<Hearts>().0 == 3 {
            step(&mut app, 1.0 / 60.0);
        }
        assert_eq!(app.world().resource::<Hearts>().0, 2);
        assert_eq!(count(&app), 3);
    }
}
