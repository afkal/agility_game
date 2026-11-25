//! Kinematic movement and collision for the dog.
//!
//! The course is made of axis-aligned boxes (ground, tables, hurdles) and
//! ramps (the two sides of the A-frame). Boxes block from every side; ramps are
//! walkable surfaces only. Everything here is plain math so it can be tested
//! without an `App`.

use bevy::math::Vec2;

/// Small tolerance so that touching surfaces do not count as overlapping.
const EPSILON: f32 = 0.01;

/// How far below the feet a grounded body still sticks to a downward ramp
/// instead of starting to fall.
const RAMP_SNAP: f32 = 24.0;

/// A grounded body steps up onto a box edge at most this high instead of being
/// blocked by it. This joins ramps smoothly to the boxes at their ends; hurdles
/// and tables are much taller and still block.
const STEP_UP: f32 = 20.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Aabb {
    pub min: Vec2,
    pub max: Vec2,
}

impl Aabb {
    pub fn from_center(center: Vec2, half: Vec2) -> Self {
        Self {
            min: center - half,
            max: center + half,
        }
    }

    pub fn overlaps(&self, other: &Aabb) -> bool {
        self.min.x < other.max.x
            && self.max.x > other.min.x
            && self.min.y < other.max.y
            && self.max.y > other.min.y
    }
}

/// A straight walkable slope between two points (`start.x < end.x`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ramp {
    pub start: Vec2,
    pub end: Vec2,
}

impl Ramp {
    /// Surface height at `x`, or `None` outside the ramp.
    pub fn height_at(&self, x: f32) -> Option<f32> {
        if x < self.start.x || x > self.end.x {
            return None;
        }
        let t = (x - self.start.x) / (self.end.x - self.start.x);
        Some(self.start.y + t * (self.end.y - self.start.y))
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Solid {
    Box(Aabb),
    Ramp(Ramp),
}

/// A moving body described by its centre and half extents.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Body {
    pub center: Vec2,
    pub half: Vec2,
    pub velocity: Vec2,
    pub grounded: bool,
}

impl Body {
    pub fn aabb(&self) -> Aabb {
        Aabb::from_center(self.center, self.half)
    }

    #[cfg(test)]
    pub fn bottom(&self) -> f32 {
        self.center.y - self.half.y
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct StepOutcome {
    /// The body tried to move sideways and a box stopped it.
    pub blocked: bool,
}

/// Move `body` by its velocity over `dt` seconds, applying `gravity` and
/// resolving collisions against `solids`. Horizontal movement is resolved
/// first (boxes block), then vertical (landing on boxes and ramps, bumping
/// heads on box undersides).
pub fn step(body: &mut Body, solids: &[Solid], gravity: f32, dt: f32) -> StepOutcome {
    let mut outcome = StepOutcome::default();
    let was_grounded = body.grounded;

    // Horizontal.
    let dx = body.velocity.x * dt;
    if dx != 0.0 {
        let current = body.aabb();
        let mut new_x = body.center.x + dx;
        let mut step_up_to: Option<f32> = None;
        for solid in solids {
            let Solid::Box(b) = solid else { continue };
            let vertical_overlap =
                current.min.y < b.max.y - EPSILON && current.max.y > b.min.y + EPSILON;
            if !vertical_overlap {
                continue;
            }
            let low_edge = was_grounded && b.max.y - current.min.y <= STEP_UP;
            let entering =
                (dx > 0.0 && current.max.x <= b.min.x + EPSILON && new_x + body.half.x > b.min.x)
                    || (dx < 0.0
                        && current.min.x >= b.max.x - EPSILON
                        && new_x - body.half.x < b.max.x);
            if low_edge && entering {
                step_up_to = Some(step_up_to.map_or(b.max.y, |h: f32| h.max(b.max.y)));
                continue;
            }
            if dx > 0.0 && current.max.x <= b.min.x + EPSILON && new_x + body.half.x > b.min.x {
                new_x = new_x.min(b.min.x - body.half.x);
                outcome.blocked = true;
            } else if dx < 0.0
                && current.min.x >= b.max.x - EPSILON
                && new_x - body.half.x < b.max.x
            {
                new_x = new_x.max(b.max.x + body.half.x);
                outcome.blocked = true;
            }
        }
        body.center.x = new_x;
        if let Some(top) = step_up_to {
            body.center.y = body.center.y.max(top + body.half.y);
        }
    }

    // Vertical.
    body.velocity.y -= gravity * dt;
    let current = body.aabb();
    let dy = body.velocity.y * dt;
    let new_bottom = current.min.y + dy;
    let mut landed_on: Option<f32> = None;
    let mut ceiling: Option<f32> = None;

    for solid in solids {
        match solid {
            Solid::Box(b) => {
                let horizontal_overlap =
                    current.min.x < b.max.x - EPSILON && current.max.x > b.min.x + EPSILON;
                if !horizontal_overlap {
                    continue;
                }
                if body.velocity.y <= 0.0
                    && current.min.y >= b.max.y - EPSILON
                    && new_bottom <= b.max.y
                {
                    landed_on = Some(landed_on.map_or(b.max.y, |h: f32| h.max(b.max.y)));
                } else if body.velocity.y > 0.0
                    && current.max.y <= b.min.y + EPSILON
                    && current.max.y + dy > b.min.y
                {
                    ceiling = Some(ceiling.map_or(b.min.y, |c: f32| c.min(b.min.y)));
                }
            }
            Solid::Ramp(r) => {
                let Some(surface) = r.height_at(body.center.x) else {
                    continue;
                };
                if body.velocity.y > 0.0 {
                    continue;
                }
                let tolerance = if was_grounded { RAMP_SNAP } else { EPSILON };
                // Walking up the slope puts the feet slightly below the surface;
                // allow that as long as the feet were not far below it.
                let feet_near_or_above = current.min.y >= surface - RAMP_SNAP;
                if feet_near_or_above && new_bottom <= surface + tolerance {
                    landed_on = Some(landed_on.map_or(surface, |h: f32| h.max(surface)));
                }
            }
        }
    }

    if let Some(surface) = landed_on {
        body.center.y = surface + body.half.y;
        body.velocity.y = 0.0;
        body.grounded = true;
    } else if let Some(c) = ceiling {
        body.center.y = c - body.half.y;
        body.velocity.y = 0.0;
        body.grounded = false;
    } else {
        body.center.y += dy;
        body.grounded = false;
    }

    outcome
}

#[cfg(test)]
mod tests {
    use super::*;

    const GRAVITY: f32 = 1875.0;
    const DT: f32 = 1.0 / 60.0;
    const HALF: Vec2 = Vec2::new(36.0, 34.0);

    fn ground() -> Solid {
        Solid::Box(Aabb {
            min: Vec2::new(-10_000.0, -400.0),
            max: Vec2::new(10_000.0, -300.0),
        })
    }

    fn standing_at(x: f32, surface: f32) -> Body {
        Body {
            center: Vec2::new(x, surface + HALF.y),
            half: HALF,
            velocity: Vec2::ZERO,
            grounded: true,
        }
    }

    fn simulate(body: &mut Body, solids: &[Solid], seconds: f32) -> bool {
        let mut blocked = false;
        let steps = (seconds / DT).round() as usize;
        for _ in 0..steps {
            blocked |= step(body, solids, GRAVITY, DT).blocked;
        }
        blocked
    }

    #[test]
    fn standing_body_stays_on_ground() {
        let mut body = standing_at(0.0, -300.0);
        simulate(&mut body, &[ground()], 1.0);
        assert!(body.grounded);
        assert!((body.bottom() + 300.0).abs() < 0.01);
    }

    #[test]
    fn jump_rises_peaks_and_lands_back_on_ground() {
        let mut body = standing_at(0.0, -300.0);
        body.velocity.y = 750.0;
        let mut peak: f32 = body.bottom();
        for _ in 0..120 {
            step(&mut body, &[ground()], GRAVITY, DT);
            peak = peak.max(body.bottom());
        }
        assert!(peak > -300.0 + 140.0, "peak was {peak}");
        assert!(body.grounded);
        assert!((body.bottom() + 300.0).abs() < 0.01);
    }

    #[test]
    fn jump_onto_higher_table_lands_on_its_top() {
        let table = Solid::Box(Aabb {
            min: Vec2::new(100.0, -300.0),
            max: Vec2::new(400.0, -210.0),
        });
        let mut body = standing_at(0.0, -300.0);
        body.velocity = Vec2::new(200.0, 750.0);
        simulate(&mut body, &[ground(), table], 1.0);
        assert!(body.grounded);
        assert!(
            (body.bottom() + 210.0).abs() < 0.01,
            "bottom {}",
            body.bottom()
        );
    }

    #[test]
    fn running_into_hurdle_stops_at_its_left_side() {
        let hurdle = Solid::Box(Aabb {
            min: Vec2::new(100.0, -300.0),
            max: Vec2::new(116.0, -255.0),
        });
        let mut body = standing_at(0.0, -300.0);
        body.velocity.x = 200.0;
        let blocked = simulate(&mut body, &[ground(), hurdle], 1.0);
        assert!(blocked);
        assert!((body.aabb().max.x - 100.0).abs() < 0.01);
    }

    #[test]
    fn jumping_over_hurdle_clears_it() {
        let hurdle = Solid::Box(Aabb {
            min: Vec2::new(100.0, -300.0),
            max: Vec2::new(116.0, -255.0),
        });
        let mut body = standing_at(0.0, -300.0);
        body.velocity = Vec2::new(200.0, 750.0);
        let blocked = simulate(&mut body, &[ground(), hurdle], 1.0);
        assert!(!blocked);
        assert!(body.aabb().min.x > 116.0);
    }

    #[test]
    fn walking_up_ramp_follows_slope_and_stays_on_top() {
        let up = Solid::Ramp(Ramp {
            start: Vec2::new(100.0, -300.0),
            end: Vec2::new(400.0, -150.0),
        });
        let top = Solid::Box(Aabb {
            min: Vec2::new(400.0, -300.0),
            max: Vec2::new(500.0, -150.0),
        });
        let mut body = standing_at(0.0, -300.0);
        body.velocity.x = 150.0;
        let mut was_on_slope = false;
        for _ in 0..180 {
            step(&mut body, &[ground(), up, top], GRAVITY, DT);
            if let Solid::Ramp(r) = up {
                if let Some(h) = r.height_at(body.center.x) {
                    if body.center.x > 150.0 && body.center.x < 350.0 {
                        assert!(body.grounded);
                        assert!((body.bottom() - h).abs() < 0.5);
                        was_on_slope = true;
                    }
                }
            }
        }
        assert!(was_on_slope);
        assert!(body.grounded);
        assert!(body.center.x > 400.0);
        assert!((body.bottom() + 150.0).abs() < 0.5);
    }

    #[test]
    fn walking_down_ramp_sticks_to_slope() {
        let down = Solid::Ramp(Ramp {
            start: Vec2::new(0.0, -150.0),
            end: Vec2::new(300.0, -300.0),
        });
        let mut body = standing_at(10.0, -155.0);
        body.velocity.x = 150.0;
        for _ in 0..90 {
            step(&mut body, &[ground(), down], GRAVITY, DT);
            assert!(body.grounded, "lost ground at x {}", body.center.x);
        }
    }

    #[test]
    fn running_off_an_edge_starts_falling() {
        let ledge = Solid::Box(Aabb {
            min: Vec2::new(-500.0, -400.0),
            max: Vec2::new(50.0, -300.0),
        });
        let mut body = standing_at(0.0, -300.0);
        body.velocity.x = 200.0;
        simulate(&mut body, &[ledge], 1.0);
        assert!(!body.grounded);
        assert!(body.bottom() < -300.0);
    }

    #[test]
    fn long_clamped_frame_does_not_pass_through_hurdle() {
        let hurdle = Solid::Box(Aabb {
            min: Vec2::new(40.0, -300.0),
            max: Vec2::new(56.0, -255.0),
        });
        let mut body = standing_at(0.0, -300.0);
        body.velocity.x = 300.0;
        // One 1/30 s step moves 10 px; repeat well past the hurdle.
        for _ in 0..30 {
            step(&mut body, &[ground(), hurdle], GRAVITY, 1.0 / 30.0);
        }
        assert!(body.aabb().max.x <= 40.0 + 0.01);
    }
}
