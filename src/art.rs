//! Shape-drawn art. Every picture in the level except the dog is built here
//! from simple meshes, so it can later be swapped for an image in one place.

use bevy::prelude::*;

pub const SNOW_WHITE: Color = Color::srgb(0.97, 0.98, 1.0);
pub const SNOW_SHADE: Color = Color::srgb(0.80, 0.87, 0.96);
pub const CANDY_RED: Color = Color::srgb(0.85, 0.12, 0.16);
pub const PINE_GREEN: Color = Color::srgb(0.10, 0.48, 0.25);
pub const DARK_PINE: Color = Color::srgb(0.06, 0.34, 0.18);
pub const GOLD: Color = Color::srgb(0.98, 0.80, 0.22);
pub const GINGERBREAD: Color = Color::srgb(0.74, 0.43, 0.19);
pub const ICING: Color = Color::srgb(1.0, 0.98, 0.94);
pub const HEART_RED: Color = Color::srgb(0.92, 0.18, 0.30);
pub const HEART_EMPTY: Color = Color::srgba(1.0, 1.0, 1.0, 0.45);

/// Makes mesh-and-colour shapes. Borrowed from the asset stores for the
/// duration of one system.
pub struct Painter<'a> {
    pub meshes: &'a mut Assets<Mesh>,
    pub materials: &'a mut Assets<ColorMaterial>,
}

impl Painter<'_> {
    pub fn material(&mut self, color: Color) -> Handle<ColorMaterial> {
        self.materials.add(color)
    }

    /// A shape at `pos` (z included) with the given rotation in radians.
    pub fn shape(
        &mut self,
        mesh: impl Into<Mesh>,
        color: Color,
        pos: Vec3,
        angle: f32,
    ) -> impl Bundle {
        (
            Mesh2d(self.meshes.add(mesh.into())),
            MeshMaterial2d(self.materials.add(color)),
            Transform::from_translation(pos).with_rotation(Quat::from_rotation_z(angle)),
        )
    }

    pub fn rect(&mut self, size: Vec2, color: Color, pos: Vec3) -> impl Bundle {
        self.shape(Rectangle::new(size.x, size.y), color, pos, 0.0)
    }

    pub fn circle(&mut self, radius: f32, color: Color, pos: Vec3) -> impl Bundle {
        self.shape(Circle::new(radius), color, pos, 0.0)
    }

    pub fn triangle(&mut self, a: Vec2, b: Vec2, c: Vec2, color: Color, z: f32) -> impl Bundle {
        self.shape(Triangle2d::new(a, b, c), color, Vec3::new(0.0, 0.0, z), 0.0)
    }
}

/// A heart of the given size, as child shapes of `parent`.
pub fn heart(
    parent: &mut ChildSpawnerCommands,
    painter: &mut Painter,
    size: f32,
    material: Handle<ColorMaterial>,
) {
    let r = size * 0.3;
    let lobe = meshes_circle(painter, r);
    let point = painter.meshes.add(Rectangle::new(r * 1.55, r * 1.55));
    for x in [-r * 0.72, r * 0.72] {
        parent.spawn((
            Mesh2d(lobe.clone()),
            MeshMaterial2d(material.clone()),
            Transform::from_xyz(x, r * 0.35, 0.0),
            HeartPiece,
        ));
    }
    parent.spawn((
        Mesh2d(point),
        MeshMaterial2d(material),
        Transform::from_xyz(0.0, -r * 0.45, 0.0)
            .with_rotation(Quat::from_rotation_z(std::f32::consts::FRAC_PI_4)),
        HeartPiece,
    ));
}

fn meshes_circle(painter: &mut Painter, radius: f32) -> Handle<Mesh> {
    painter.meshes.add(Circle::new(radius))
}

/// One shape of a heart; the HUD recolours these when a heart is lost.
#[derive(Component)]
pub struct HeartPiece;

/// A little gingerbread man of the given height, as child shapes of `parent`.
pub fn gingerbread_man(parent: &mut ChildSpawnerCommands, painter: &mut Painter, height: f32) {
    let s = height / 40.0;
    parent.spawn(painter.circle(7.0 * s, GINGERBREAD, Vec3::new(0.0, 12.0 * s, 0.0)));
    parent.spawn(painter.shape(
        Capsule2d::new(7.5 * s, 10.0 * s),
        GINGERBREAD,
        Vec3::new(0.0, -2.0 * s, 0.0),
        0.0,
    ));
    parent.spawn(painter.shape(
        Capsule2d::new(3.0 * s, 20.0 * s),
        GINGERBREAD,
        Vec3::new(0.0, 4.0 * s, -0.1),
        std::f32::consts::FRAC_PI_2,
    ));
    for x in [-5.0, 5.0] {
        parent.spawn(painter.shape(
            Capsule2d::new(3.2 * s, 9.0 * s),
            GINGERBREAD,
            Vec3::new(x * s, -12.0 * s, -0.1),
            x.signum() * 0.35,
        ));
    }
    // Icing: eyes, smile buttons.
    for x in [-2.5, 2.5] {
        parent.spawn(painter.circle(1.2 * s, ICING, Vec3::new(x * s, 13.5 * s, 0.1)));
    }
    for y in [2.0, -3.0] {
        parent.spawn(painter.circle(1.5 * s, ICING, Vec3::new(0.0, y * s, 0.1)));
    }
}
