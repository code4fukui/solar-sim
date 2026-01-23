// Three.js: 4m x 6m の「部屋」(箱) を作る。東(+X)と南(+Z)に窓あり。
// 座標系: +X=東, -X=西, +Z=南, -Z=北, +Y=上
// 返り値: THREE.Group（床/天井/壁/窓ガラスを含む）
//
// 使い方例:
//   const room = makeHouse({ width: 4, depth: 6, height: 3 });
//   scene.add(room);

import * as THREE from "three";

export function makeHouse({
  width = 4,
  depth = 6,
  height = 3.0,
  wallT = 0.15,          // 壁厚
  floorT = 0.12,
  // 窓（東壁/南壁）: ここを調整
  winEast = { w: 2.4, h: 1.2, sill: 0.9, center: 0.0 }, // center: 壁の中心からのオフセット（東壁ならZ方向）
  winSouth = { w: 3.0, h: 1.4, sill: 0.7, center: 0.0 },// center: 壁の中心からのオフセット（南壁ならX方向）
  // 材質
  wallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.95 }),
  floorMat = new THREE.MeshStandardMaterial({ color: 0xc8b08a, roughness: 0.9 }),
  ceilMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 1.0 }),
  glassMat = new THREE.MeshStandardMaterial({ color: 0x99bbcc, roughness: 0.15, transparent: true, opacity: 0.28 }),
} = {}) {
  const g = new THREE.Group();

  // ---- helpers ----
  const makeBox = (sx, sy, sz, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /**
   * 壁(長さL)に窓(幅winW/高さwinH)を「くり抜いたように」見せるため
   * 4つの矩形（下/上/左/右）に分割して壁を作る。
   *
   * axis: "x" なら壁はX方向に長い（南北壁）
   * axis: "z" なら壁はZ方向に長い（東西壁）
   *
   * 壁中心は (cx, cy, cz) に置く。窓中心オフセットは axis方向に対して直交方向へ。
   */
  const buildWallWithWindow = ({
    axis,              // "x" or "z"
    L,                 // 壁の長さ
    H,                 // 壁の高さ
    T,                 // 壁の厚み
    center,            // {x,y,z} 壁の中心
    winW, winH, sill,  // 窓寸法
    offsetAlong,       // 窓の中心を壁の中心からどれだけずらすか（axis方向）
    outwardNormal,     // {x,y,z} 壁の外向き（ガラス面の向きに使う）
  }) => {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(center.x, center.y, center.z);

    // clamp (安全策)
    winW = Math.min(winW, L - 0.2);
    winH = Math.min(winH, H - 0.2);
    sill = Math.max(0.0, Math.min(sill, H - winH - 0.05));

    const yBottom = -H / 2;
    const yTop = H / 2;

    const yWinBottom = yBottom + sill;
    const yWinTop = yWinBottom + winH;

    // axisに沿った窓位置
    const halfL = L / 2;
    const winCenter = offsetAlong; // 壁中心からのずらし
    const winLeft = winCenter - winW / 2;
    const winRight = winCenter + winW / 2;

    // pieces sizes
    const lowerH = (yWinBottom - yBottom);
    const upperH = (yTop - yWinTop);
    const leftW = (winLeft + halfL);
    const rightW = (halfL - winRight);

    // 下（窓下）
    if (lowerH > 0.001) {
      const box = makeBox(
        axis === "x" ? L : T,
        lowerH,
        axis === "x" ? T : L,
        wallMat
      );
      box.position.set(0, yBottom + lowerH / 2, 0);
      wallGroup.add(box);
    }

    // 上（窓上）
    if (upperH > 0.001) {
      const box = makeBox(
        axis === "x" ? L : T,
        upperH,
        axis === "x" ? T : L,
        wallMat
      );
      box.position.set(0, yWinTop + upperH / 2 - center.y, 0); // ←ここは相対座標に揃える
      // ただし wallGroup.position にcenter.yを入れているので、子のyは相対でOK
      box.position.y = yWinTop + upperH / 2;
      wallGroup.add(box);
    }

    // 左（窓の左）
    if (leftW > 0.001) {
      const box = makeBox(
        axis === "x" ? leftW : T,
        winH,
        axis === "x" ? T : leftW,
        wallMat
      );
      if (axis === "x") {
        box.position.set(-halfL + leftW / 2, yWinBottom + winH / 2, 0);
      } else {
        box.position.set(0, yWinBottom + winH / 2, -halfL + leftW / 2);
      }
      wallGroup.add(box);
    }

    // 右（窓の右）
    if (rightW > 0.001) {
      const box = makeBox(
        axis === "x" ? rightW : T,
        winH,
        axis === "x" ? T : rightW,
        wallMat
      );
      if (axis === "x") {
        box.position.set(halfL - rightW / 2, yWinBottom + winH / 2, 0);
      } else {
        box.position.set(0, yWinBottom + winH / 2, halfL - rightW / 2);
      }
      wallGroup.add(box);
    }

    // ガラス（窓面）
    // ガラスは壁厚の中央あたりに薄く置く（外向きに少し寄せる）
    const glassT = 0.02;
    const glass = makeBox(
      axis === "x" ? winW : glassT,
      winH,
      axis === "x" ? glassT : winW,
      glassMat
    );

    if (axis === "x") {
      // 南北壁：長さはX、厚みはZ
      glass.position.set(
        winCenter,
        yWinBottom + winH / 2,
        outwardNormal.z * (T / 2 - glassT / 2)
      );
    } else {
      // 東西壁：長さはZ、厚みはX
      glass.position.set(
        outwardNormal.x * (T / 2 - glassT / 2),
        yWinBottom + winH / 2,
        winCenter
      );
    }
    glass.castShadow = false;
    wallGroup.add(glass);

    wallGroup.position.set(0, 0, 0);
    wallGroup.position.copy(new THREE.Vector3(center.x, center.y, center.z));
    g.add(wallGroup);
  };

  // ---- floor / ceiling ----
  const floor = makeBox(width - wallT * 2, floorT, depth - wallT * 2, floorMat);
  floor.position.set(0, floorT / 2, 0);
  g.add(floor);

  const ceiling = makeBox(width, 0.08, depth, ceilMat);
  ceiling.position.set(0, height + 0.04, 0);
  ceiling.castShadow = true;
  ceiling.receiveShadow = true;
  g.add(ceiling);

  const wallY = height / 2;

  // ---- walls without windows ----
  // 西壁 (-X): 長さZ
  {
    const w = makeBox(wallT, height, depth, wallMat);
    w.position.set(-width / 2 + wallT / 2, wallY, 0);
    g.add(w);
  }

  // 北壁 (-Z): 長さX
  {
    const w = makeBox(width, height, wallT, wallMat);
    w.position.set(0, wallY, -depth / 2 + wallT / 2);
    g.add(w);
  }

  // ---- walls WITH windows ----
  // 東壁 (+X): 長さZ（axis="z"）
  buildWallWithWindow({
    axis: "z",
    L: depth,
    H: height,
    T: wallT,
    center: { x: +width / 2 - wallT / 2, y: wallY, z: 0 },
    winW: winEast.w,
    winH: winEast.h,
    sill: winEast.sill,
    offsetAlong: winEast.center,           // Z方向のずらし
    outwardNormal: { x: +1, y: 0, z: 0 },  // 外向き
  });

  // 南壁 (+Z): 長さX（axis="x"）
  buildWallWithWindow({
    axis: "x",
    L: width,
    H: height,
    T: wallT,
    center: { x: 0, y: wallY, z: +depth / 2 - wallT / 2 },
    winW: winSouth.w,
    winH: winSouth.h,
    sill: winSouth.sill,
    offsetAlong: winSouth.center,          // X方向のずらし
    outwardNormal: { x: 0, y: 0, z: +1 },  // 外向き
  });

  return g;
}
